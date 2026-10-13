import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { APP_TIME_ZONE } from '@/common/time';
import { PrismaService } from '@/prisma';
import { toWhatsappNumber, WhatsappService } from '@/whatsapp';

/** Who a slot points at — a club member or a guest, never both (the same
 * union `MeetingRoleAssignment` and `MeetingSpeaker` store). */
export interface SlotHolder {
  membershipId: string | null;
  guestId: string | null;
}

interface Recipient {
  firstName: string;
  /** International WhatsApp digits, already validated. */
  number: string;
  /** Has an account to open in-app links with. Guests and unclaimed roster
   * rows don't, so they get the public agenda instead. */
  inApp: boolean;
}

interface MeetingSummary {
  id: string;
  meetingNumber: number;
  dateTime: Date;
  theme: string;
  clubName: string;
}

/** Mirrors `buildRoles()` in the web's `lib/meetings/roles.ts` — that list is
 * presentation-owned, so a key missing here falls back to its title-cased
 * form rather than failing the message. */
const ROLE_LABELS: Record<string, string> = {
  president: 'President',
  'sergeant-at-arms': 'Sergeant at Arms',
  'general-evaluator': 'General Evaluator',
  'table-topic-master': 'Table Topic Master',
  'table-topic-evaluator': 'Table Topic Evaluator',
  'ah-counter': 'Ah Counter',
  timer: 'Timer',
  grammarian: 'Grammarian',
  harkmaster: 'Harkmaster',
};

/* Gap between two sends. The worker sends whatever it's handed immediately,
 * and a burst of identical messages from a linked device is exactly what gets
 * a number banned — so a club-wide announcement trickles out instead. */
const MIN_GAP_MS = 2_000;
const MAX_GAP_MS = 5_000;

/* A meeting stays current until 2 hours after it starts, then it's past —
 * the web's `MEETING_PAST_AFTER_MS`. Nothing is sent about a past meeting:
 * publishing an old one for the record or fixing last week's Timer isn't news. */
const MEETING_PAST_AFTER_MS = 2 * 60 * 60 * 1000;

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** WhatsApp messages about meetings: the club-wide "new meeting" announcement,
 * role added/removed, and a confirmed prepared speech.
 *
 * Every public method is fire-and-forget — it returns immediately, and a
 * notification that fails (worker offline, bad number) is logged, never
 * surfaced to the request that triggered it. Callers invoke these only after
 * their transaction commits, so a rolled-back change never sends anything.
 *
 * Sends go through one in-process outbox, one at a time with a random gap.
 * It isn't persisted: a deploy restart mid-announcement drops whatever was
 * still waiting. */
@Injectable()
export class MeetingNotificationsService {
  private readonly logger = new Logger(MeetingNotificationsService.name);
  private readonly webUrl: string;
  private outbox: Promise<void> = Promise.resolve();
  private nextSendAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    config: ConfigService,
  ) {
    const origin =
      config.get<string>('SITE_URL') ||
      (config.get<string>('CORS_ORIGINS') ?? '').split(',')[0]?.trim() ||
      'http://localhost:3000';
    this.webUrl = origin.replace(/\/+$/, '');
  }

  /** "New meeting scheduled" to every active member of the club. The caller
   * has already claimed `Meeting.announcedAt`, so this runs once per meeting. */
  meetingPublished(meetingId: string, actorMembershipId: string | null): void {
    this.run('meeting announcement', async () => {
      const meeting = await this.loadMeeting(meetingId);
      if (!meeting) return;
      const members = await this.prisma.membership.findMany({
        where: {
          clubId: meeting.clubId,
          status: 'active',
          // Guest-only memberships aren't part of the club proper.
          NOT: { roles: { equals: ['Guest'] } },
          ...(actorMembershipId ? { id: { not: actorMembershipId } } : {}),
        },
        select: memberSelect,
      });
      const seen = new Set<string>();
      for (const member of members) {
        const recipient = toMemberRecipient(member);
        if (!recipient || seen.has(recipient.number)) continue;
        seen.add(recipient.number);
        this.enqueue(
          recipient.number,
          [
            `*New meeting scheduled* 📅`,
            `${meeting.clubName} — Meeting #${meeting.meetingNumber}`,
            `Theme: ${meeting.theme}`,
            `When: ${formatDate(meeting.dateTime)}`,
            '',
            `See the details: ${this.meetingLink(meeting, recipient)}`,
          ].join('\n'),
        );
      }
    });
  }

  /** Tells the previous holder they were taken off a role and the new one
   * they were put on it. A no-op when the holder didn't actually change. */
  roleChanged(
    meetingId: string,
    roleKey: string,
    previous: SlotHolder,
    next: SlotHolder,
    actorMembershipId: string | null,
  ): void {
    if (sameHolder(previous, next)) return;
    this.run('role change', async () => {
      const meeting = await this.loadMeeting(meetingId);
      if (!meeting) return;
      const role = roleLabel(roleKey, meeting.dateTime);
      const when = `${meeting.clubName} Meeting #${meeting.meetingNumber} (${meeting.theme}) on ${formatDate(meeting.dateTime)}`;

      const removed = await this.resolveHolder(meeting.clubId, previous, actorMembershipId);
      if (removed) {
        this.enqueue(
          removed.number,
          [
            `Hi ${removed.firstName}, you're no longer *${role}* for ${when}.`,
            '',
            `See the roles: ${this.meetingLink(meeting, removed, 'roles')}`,
          ].join('\n'),
        );
      }
      const added = await this.resolveHolder(meeting.clubId, next, actorMembershipId);
      if (added) {
        this.enqueue(
          added.number,
          [
            `Hi ${added.firstName}, you've been assigned as *${role}* for ${when}.`,
            '',
            `See the roles: ${this.meetingLink(meeting, added, 'roles')}`,
          ].join('\n'),
        );
      }
    });
  }

  /** The speech details, sent to the speaker once their slot is confirmed. */
  speakerConfirmed(speakerId: string, actorMembershipId: string | null): void {
    this.run('speaker confirmation', async () => {
      const speaker = await this.prisma.meetingSpeaker.findUnique({
        where: { id: speakerId },
        select: {
          meetingId: true,
          kind: true,
          title: true,
          duration: true,
          pathway: true,
          project: true,
          membershipId: true,
          guestId: true,
          evaluatorMembership: { select: { firstName: true, lastName: true } },
          evaluatorGuest: { select: { firstName: true, lastName: true } },
        },
      });
      if (!speaker) return;
      const meeting = await this.loadMeeting(speaker.meetingId);
      if (!meeting) return;
      const recipient = await this.resolveHolder(meeting.clubId, speaker, actorMembershipId);
      if (!recipient) return;

      const isKeynote = speaker.kind === 'keynote';
      const evaluator = speaker.evaluatorMembership ?? speaker.evaluatorGuest;
      const project = [speaker.pathway, speaker.project].filter(Boolean).join(' — ');
      const lines = [
        `Hi ${recipient.firstName}, your ${isKeynote ? 'keynote' : 'speech'} for ${meeting.clubName} Meeting #${meeting.meetingNumber} is confirmed ✅`,
        '',
        `When: ${formatDate(meeting.dateTime)}`,
        `Theme: ${meeting.theme}`,
      ];
      if (speaker.title) lines.push(`Title: ${speaker.title}`);
      if (!isKeynote && project) lines.push(`Project: ${project}`);
      if (speaker.duration) lines.push(`Time: ${speaker.duration} min`);
      if (!isKeynote && evaluator) {
        lines.push(`Evaluator: ${`${evaluator.firstName} ${evaluator.lastName}`.trim()}`);
      }
      lines.push('', `Details: ${this.meetingLink(meeting, recipient, 'prepared-speakers')}`);
      this.enqueue(recipient.number, lines.join('\n'));
    });
  }

  /** Runs the lookup in the background — the triggering request never waits
   * on it or sees its errors. Skipped outright while WhatsApp isn't set up. */
  private run(label: string, work: () => Promise<void>): void {
    if (!this.whatsapp.isConfigured) return;
    void work().catch((error: unknown) => {
      this.logger.error(`WhatsApp ${label} failed: ${errorMessage(error)}`);
    });
  }

  private enqueue(number: string, text: string): void {
    this.outbox = this.outbox.then(() => this.deliver(number, text));
  }

  /** Never rejects — the outbox chain has to survive a failed send. */
  private async deliver(number: string, text: string): Promise<void> {
    const wait = this.nextSendAt - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      await this.whatsapp.sendText(number, text);
    } catch (error) {
      this.logger.warn(`WhatsApp send to ${number} failed: ${errorMessage(error)}`);
    }
    this.nextSendAt = Date.now() + MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
  }

  /** In-app members land on the meeting (on `tab` when given); everyone else
   * gets the public agenda, which needs no login. */
  private meetingLink(meeting: MeetingSummary, recipient: Recipient, tab?: string): string {
    if (!recipient.inApp) return `${this.webUrl}/meetings/${meeting.id}/agenda`;
    return `${this.webUrl}/meetings/${meeting.id}${tab ? `?tab=${tab}` : ''}`;
  }

  /** Null for a missing meeting or one that's already over. */
  private async loadMeeting(meetingId: string) {
    const row = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        clubId: true,
        meetingNumber: true,
        dateTime: true,
        theme: true,
        club: { select: { name: true } },
      },
    });
    if (!row || row.dateTime.getTime() + MEETING_PAST_AFTER_MS < Date.now()) return null;
    return { ...row, clubName: row.club.name };
  }

  /** The person behind a slot, or null when there's nobody to message: an
   * empty slot, the person who made the change, or no usable number. */
  private async resolveHolder(
    clubId: string,
    holder: SlotHolder,
    actorMembershipId: string | null,
  ): Promise<Recipient | null> {
    if (holder.membershipId) {
      if (holder.membershipId === actorMembershipId) return null;
      const member = await this.prisma.membership.findUnique({
        where: { clubId_id: { clubId, id: holder.membershipId } },
        select: memberSelect,
      });
      return member ? toMemberRecipient(member) : null;
    }
    if (holder.guestId) {
      const guest = await this.prisma.prospect.findUnique({
        where: { clubId_id: { clubId, id: holder.guestId } },
        select: { firstName: true, whatsapp: true, phone: true },
      });
      if (!guest) return null;
      const number = firstWhatsappNumber(guest.whatsapp, guest.phone);
      return number ? { firstName: guest.firstName, number, inApp: false } : null;
    }
    return null;
  }
}

const memberSelect = {
  firstName: true,
  phone: true,
  userId: true,
  person: { select: { whatsapp: true } },
} as const;

function toMemberRecipient(member: {
  firstName: string;
  phone: string | null;
  userId: string | null;
  person: { whatsapp: string | null } | null;
}): Recipient | null {
  const number = firstWhatsappNumber(member.person?.whatsapp, member.phone);
  return number ? { firstName: member.firstName, number, inApp: member.userId !== null } : null;
}

/** The first candidate that's a valid BD WhatsApp number — a dedicated
 * WhatsApp number wins over the phone, but a malformed one doesn't block it. */
function firstWhatsappNumber(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return toWhatsappNumber(candidate);
    } catch {
      // try the next one
    }
  }
  return null;
}

function sameHolder(a: SlotHolder, b: SlotHolder): boolean {
  return a.membershipId === b.membershipId && a.guestId === b.guestId;
}

/** Toastmaster reads "of the Evening" from 5 PM Bangladesh time, the same
 * cutoff as `getToastmasterLabel()` on the web. */
function roleLabel(roleKey: string, dateTime: Date): string {
  if (roleKey === 'toastmaster') {
    const dhakaHour = (dateTime.getUTCHours() + 6) % 24;
    return dhakaHour >= 17 ? 'Toast Master of the Evening' : 'Toast Master of the Day';
  }
  return (
    ROLE_LABELS[roleKey] ??
    roleKey
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

function formatDate(value: Date): string {
  return dateFormat.format(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
