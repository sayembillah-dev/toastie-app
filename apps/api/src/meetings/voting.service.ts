import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import type {
  OpenVotingDto,
  SetVoteCandidatesDto,
  SubmitPublicVoteDto,
  VoteCandidateInputDto,
} from './dto/voting.dto';
import { MeetingNotificationsService } from './meeting-notifications.service';
import {
  fullName,
  isVoteCategoryKey,
  type MeetingVoteResultsWire,
  type MeetingVoteSetupWire,
  type MeetingVotingStatusWire,
  normalizeCandidateName,
  type OpenVotingResultWire,
  type PublicMeetingVoteWire,
  tableTopicsSpeakersFromTimerState,
  VOTE_CATEGORIES,
  type VoteCategoryKey,
  type VoteCategoryResultsWire,
  type VoteCategoryWire,
  votingStateOf,
} from './voting';

/** The meeting columns every voting read needs. */
const meetingVotingSelect = {
  id: true,
  clubId: true,
  votingOpenedAt: true,
  votingClosedAt: true,
  votingLinkSentAt: true,
} as const;

type VotingMeeting = {
  id: string;
  clubId: string;
  votingOpenedAt: Date | null;
  votingClosedAt: Date | null;
  votingLinkSentAt: Date | null;
};

/** Desired candidate for one category, produced by the meeting-data
 * derivation in `syncCandidates`. */
interface DerivedCandidate {
  name: string;
  membershipId?: string;
  guestId?: string;
}

/** Handles meeting voting — the anonymous "best of the meeting" ballot.
 *
 * Two trust levels meet here:
 * - Officers manage the ballot (candidate lists) and read the tally through
 *   the authenticated `/meetings/:id/vote/*` routes, gated by
 *   `meeting:read` / `meeting:update`.
 * - Voters cast through `/public/meetings/:id/vote` behind the meeting's
 *   share token — same (id, token) gate as the public evaluation and role
 *   pages. Nothing about the voter is stored beyond their browser's random
 *   voter key.
 */
@Injectable()
export class VotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: MeetingNotificationsService,
  ) {}

  // ---------------------------------------------------------- authed --

  async listCandidates(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'read', meeting.clubId);
    /* Officers' reads keep every award topped up from the meeting data, so
     * the ballot needs no manual "sync" step. Viewers only top up the
     * self-filling category, as every read always has. */
    if (can(subject, 'update', 'meeting', { clubId: meeting.clubId })) {
      await this.insertDerivedCandidates(meeting.clubId, meetingId);
    } else {
      await this.syncAutoCategories(meeting.clubId, meetingId);
    }
    return this.readSetup(meeting);
  }

  /** `GET /meetings/:id/vote/status` — the lifecycle and WhatsApp state on
   * their own, for clients that only need to poll that. */
  async getStatus(subject: PermissionSubject, meetingId: string): Promise<MeetingVotingStatusWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'read', meeting.clubId);
    return this.readStatus(meeting);
  }

  /** Start / Reopen. Tops the ballot up from the meeting data, marks voting
   * open (a reopen clears the close and keeps the first opening time), and —
   * when asked, and only the first time — sends the voting link on WhatsApp
   * to everyone checked in. The send is claimed with a conditional update
   * so two officers pressing Start together message the room once, and it
   * is only claimed when there is someone to message. */
  async openVoting(
    subject: PermissionSubject,
    meetingId: string,
    dto: OpenVotingDto,
  ): Promise<OpenVotingResultWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);
    const clubId = meeting.clubId;

    await this.insertDerivedCandidates(clubId, meetingId);
    const now = new Date();
    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { votingOpenedAt: meeting.votingOpenedAt ?? now, votingClosedAt: null },
    });

    let whatsappQueued = 0;
    if (dto.notifyWhatsapp && !meeting.votingLinkSentAt && this.notifications.whatsappAvailable) {
      const recipients = await this.notifications.votingRecipients(clubId, meetingId);
      if (recipients.length > 0) {
        const claimed = await this.prisma.meeting.updateMany({
          where: { id: meetingId, votingLinkSentAt: null },
          data: { votingLinkSentAt: now },
        });
        if (claimed.count === 1) {
          const details = await this.prisma.meeting.findUniqueOrThrow({
            where: { id: meetingId },
            select: {
              id: true,
              meetingNumber: true,
              shareToken: true,
              club: { select: { name: true } },
            },
          });
          whatsappQueued = this.notifications.sendVotingLink(
            { ...details, clubName: details.club.name },
            recipients,
          );
        }
      }
    }

    return { status: await this.readStatus(await this.loadMeeting(meetingId)), whatsappQueued };
  }

  /** Close — the ballot stops accepting votes and the winners can be shown.
   * Closing a vote that was never started counts as having opened it now. */
  async closeVoting(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingVotingStatusWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);
    if (!meeting.votingClosedAt) {
      const now = new Date();
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { votingOpenedAt: meeting.votingOpenedAt ?? now, votingClosedAt: now },
      });
    }
    return this.readStatus(await this.loadMeeting(meetingId));
  }

  /** "Sync from meeting data" — derive each category's candidates from what
   * the meeting already knows (speakers, evaluators, present attendees, role
   * holders) and insert the ones not already on the ballot. Never removes
   * anything, and never brings back a name an officer removed: the dedupe
   * set below deliberately includes removed rows. */
  async syncCandidates(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);
    await this.insertDerivedCandidates(meeting.clubId, meetingId);
    return this.readSetup(meeting);
  }

  /** Insert every derived candidate not already on the ballot (removed rows
   * included in the dedupe, so a removed name stays removed). Shared by the
   * officer setup read, Start, and the explicit sync endpoint. */
  private async insertDerivedCandidates(clubId: string, meetingId: string): Promise<void> {
    const derived = await this.deriveCandidates(clubId, meetingId);
    const existing = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId, meetingId },
      select: { category: true, name: true, membershipId: true, guestId: true },
    });

    /* A candidate is "already there" when it matches on the roster link
     * (same person, renamed) or on the folded name. */
    const seen = new Set(
      existing.flatMap((row) => dedupeKeys(row.category, row.membershipId, row.guestId, row.name)),
    );

    const creates: {
      clubId: string;
      meetingId: string;
      category: string;
      name: string;
      membershipId?: string;
      guestId?: string;
      source: 'auto';
    }[] = [];
    for (const [category, people] of derived) {
      for (const person of people) {
        const keys = dedupeKeys(category, person.membershipId, person.guestId, person.name);
        if (keys.some((key) => seen.has(key))) continue;
        for (const key of keys) seen.add(key);
        creates.push({
          clubId,
          meetingId,
          category,
          name: person.name,
          membershipId: person.membershipId,
          guestId: person.guestId,
          source: 'auto',
        });
      }
    }

    if (creates.length > 0) {
      /* skipDuplicates guards the name-unique index for the case where the
       * same name arrives through two different people (rare, but a guest
       * can share a member's name). */
      await this.prisma.meetingVoteCandidate.createMany({ data: creates, skipDuplicates: true });
    }
  }

  /** Replace one category's candidate list with the officer's edit — the
   * same for every category, Table Topics included. Rows whose name survived
   * the edit keep their id (and the votes cast for them). Names left out are
   * marked removed rather than deleted, so the automatic top-ups don't bring
   * them back; their picks drop out of the tally. Adding a removed name
   * again restores the same row, votes and all. */
  async setCategoryCandidates(
    subject: PermissionSubject,
    meetingId: string,
    category: string,
    dto: SetVoteCandidatesDto,
  ): Promise<MeetingVoteSetupWire> {
    if (!isVoteCategoryKey(category)) {
      throw new BadRequestException({
        code: 'UNKNOWN_VOTE_CATEGORY',
        message: `Vote category must be one of: ${VOTE_CATEGORIES.map((c) => c.key).join(', ')}`,
      });
    }
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);
    const clubId = meeting.clubId;

    /* Fold the incoming list: trim, drop blanks, dedupe case-insensitively
     * (first occurrence wins). */
    const incoming = new Map<string, VoteCandidateInputDto>();
    for (const candidate of dto.candidates) {
      const name = candidate.name.trim().replace(/\s+/g, ' ');
      const norm = normalizeCandidateName(name);
      if (!norm || incoming.has(norm)) continue;
      incoming.set(norm, { ...candidate, name });
    }

    await this.assertRosterLinks(clubId, [...incoming.values()]);

    await this.prisma.$transaction(async (tx) => {
      /* Removed rows included: the name-unique index still covers them, so
       * re-adding one must restore that row rather than create a twin. */
      const existing = await tx.meetingVoteCandidate.findMany({
        where: { clubId, meetingId, category },
        select: { id: true, name: true, removedAt: true },
      });
      const existingByNorm = new Map(
        existing.map((row) => [normalizeCandidateName(row.name), row] as const),
      );

      const removeIds = existing
        .filter((row) => !row.removedAt && !incoming.has(normalizeCandidateName(row.name)))
        .map((row) => row.id);
      const restores = [...incoming.entries()].flatMap(([norm, candidate]) => {
        const row = existingByNorm.get(norm);
        return row?.removedAt ? [{ id: row.id, candidate }] : [];
      });
      const toCreate = [...incoming.entries()]
        .filter(([norm]) => !existingByNorm.has(norm))
        .map(([, candidate]) => ({
          clubId,
          meetingId,
          category,
          name: candidate.name,
          membershipId: candidate.membershipId,
          guestId: candidate.guestId,
          source: 'manual' as const,
        }));

      if (removeIds.length > 0) {
        await tx.meetingVoteCandidate.updateMany({
          where: { id: { in: removeIds } },
          data: { removedAt: new Date() },
        });
      }
      for (const { id, candidate } of restores) {
        await tx.meetingVoteCandidate.update({
          where: { id },
          data: {
            removedAt: null,
            source: 'manual',
            name: candidate.name,
            membershipId: candidate.membershipId ?? null,
            guestId: candidate.guestId ?? null,
          },
        });
      }
      if (toCreate.length > 0) {
        await tx.meetingVoteCandidate.createMany({ data: toCreate, skipDuplicates: true });
      }
    });

    return this.readSetup(meeting);
  }

  async getResults(subject: PermissionSubject, meetingId: string): Promise<MeetingVoteResultsWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'read', meeting.clubId);
    /* Keep the self-topping category current so the board shows a late
     * Table Topics speaker (with 0 votes) without waiting for someone to
     * revisit the setup read. */
    await this.syncAutoCategories(meeting.clubId, meetingId);

    const [candidates, ballots] = await Promise.all([
      this.prisma.meetingVoteCandidate.findMany({
        where: { clubId: meeting.clubId, meetingId, removedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, category: true, name: true },
      }),
      this.prisma.meetingVoteBallot.findMany({
        where: { clubId: meeting.clubId, meetingId },
        select: { picks: true },
      }),
    ]);

    const tallies = new Map<string, { id: string; name: string; votes: number }[]>();
    const candidateIndex = new Map<string, { id: string; name: string; votes: number }>();
    for (const category of VOTE_CATEGORIES) tallies.set(category.key, []);
    for (const candidate of candidates) {
      const bucket = tallies.get(candidate.category);
      if (!bucket) continue; // a category the code no longer knows about
      const entry = { id: candidate.id, name: candidate.name, votes: 0 };
      bucket.push(entry);
      candidateIndex.set(candidate.id, entry);
    }

    const categoryTotals = new Map<string, number>();
    for (const ballot of ballots) {
      const picks = ballot.picks as Record<string, unknown>;
      for (const category of VOTE_CATEGORIES) {
        const candidateId = picks[category.key];
        if (typeof candidateId !== 'string') continue;
        const entry = candidateIndex.get(candidateId);
        if (!entry) continue; // pick points at a since-removed candidate
        entry.votes += 1;
        categoryTotals.set(category.key, (categoryTotals.get(category.key) ?? 0) + 1);
      }
    }

    const categories: VoteCategoryResultsWire[] = VOTE_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      question: category.question,
      totalVotes: categoryTotals.get(category.key) ?? 0,
      candidates: tallies.get(category.key) ?? [],
    }));
    return {
      totalBallots: ballots.length,
      categories,
      status: await this.readStatus(meeting),
    };
  }

  /** "Clear" on one award — wipes that category's pick out of every ballot
   * (test votes, a re-run after a mix-up). Candidates stay on the ballot;
   * ballots left with no picks at all are removed so the "N ballots in"
   * headline stays honest. The voter keeps no trace of the cleared pick —
   * re-voting after a clear starts that category fresh. */
  async clearCategoryVotes(
    subject: PermissionSubject,
    meetingId: string,
    category: string,
  ): Promise<{ cleared: number }> {
    if (!isVoteCategoryKey(category)) {
      throw new BadRequestException({
        code: 'UNKNOWN_VOTE_CATEGORY',
        message: `Vote category must be one of: ${VOTE_CATEGORIES.map((c) => c.key).join(', ')}`,
      });
    }
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);

    return this.prisma.$transaction(async (tx) => {
      const ballots = await tx.meetingVoteBallot.findMany({
        where: { clubId: meeting.clubId, meetingId },
        select: { id: true, picks: true },
      });

      let cleared = 0;
      for (const ballot of ballots) {
        /* Values are candidate-id strings all the way down — see
         * submitPublicBallot, which strips anything else on the way in. */
        const picks = ballot.picks as Record<string, string>;
        if (!(category in picks)) continue;
        cleared += 1;
        const rest = { ...picks };
        delete rest[category];
        if (Object.keys(rest).length === 0) {
          await tx.meetingVoteBallot.delete({ where: { id: ballot.id } });
        } else {
          await tx.meetingVoteBallot.update({ where: { id: ballot.id }, data: { picks: rest } });
        }
      }
      return { cleared };
    });
  }

  // ---------------------------------------------------------- public --

  /** The anonymous ballot — meeting header, questions with dropdown options,
   * and the device's previous picks when it passes its voter key back. */
  async getPublicBallot(
    meetingId: string,
    token: string | undefined,
    voterKey?: string,
  ): Promise<PublicMeetingVoteWire> {
    const meeting = await this.loadMeetingByToken(meetingId, token);
    /* The ballot must offer every Table Topics speaker the meeting knows
     * about — top that category up before reading it back. */
    await this.syncAutoCategories(meeting.clubId, meetingId);

    const [candidates, ballot] = await Promise.all([
      this.prisma.meetingVoteCandidate.findMany({
        where: { clubId: meeting.clubId, meetingId, removedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, category: true, name: true },
      }),
      voterKey
        ? this.prisma.meetingVoteBallot.findUnique({
            where: {
              clubId_meetingId_voterKey: { clubId: meeting.clubId, meetingId, voterKey },
            },
            select: { picks: true },
          })
        : Promise.resolve(null),
    ]);

    const categories = groupPublicCandidates(candidates);

    /* Prefill only picks that are still votable — a candidate removed since
     * the last visit must not come back selected. */
    let picks: Record<string, string> | null = null;
    if (ballot) {
      const valid = new Map(candidates.map((c) => [c.id, c.category] as const));
      const raw = ballot.picks as Record<string, unknown>;
      picks = {};
      for (const [category, candidateId] of Object.entries(raw)) {
        if (typeof candidateId === 'string' && valid.get(candidateId) === category) {
          picks[category] = candidateId;
        }
      }
    }

    return {
      meeting: {
        id: meeting.id,
        meetingNumber: meeting.meetingNumber,
        dateTime: meeting.dateTime.toISOString(),
        theme: meeting.theme,
        clubName: meeting.club.name,
      },
      categories,
      picks,
      state: votingStateOf(meeting),
    };
  }

  /** Cast (or re-cast) a ballot. Upserted on (meeting, voterKey): a
   * resubmission from the same device replaces the earlier one. */
  async submitPublicBallot(
    meetingId: string,
    token: string | undefined,
    dto: SubmitPublicVoteDto,
  ): Promise<{ id: string }> {
    const meeting = await this.loadMeetingByToken(meetingId, token);
    if (votingStateOf(meeting) === 'closed') {
      throw new ConflictException({
        code: 'VOTING_CLOSED',
        message: 'Voting has closed for this meeting',
      });
    }

    const candidates = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId: meeting.clubId, meetingId, removedAt: null },
      select: { id: true, category: true },
    });
    const valid = new Map(candidates.map((c) => [c.id, c.category] as const));

    const picks: Record<string, string> = {};
    for (const [category, candidateId] of Object.entries(dto.picks ?? {})) {
      if (!isVoteCategoryKey(category) || typeof candidateId !== 'string') continue;
      if (valid.get(candidateId) === category) picks[category] = candidateId;
    }
    if (Object.keys(picks).length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_BALLOT',
        message: 'Pick at least one person before submitting your vote',
      });
    }

    const row = await this.prisma.meetingVoteBallot.upsert({
      where: {
        clubId_meetingId_voterKey: {
          clubId: meeting.clubId,
          meetingId,
          voterKey: dto.voterKey,
        },
      },
      create: { clubId: meeting.clubId, meetingId, voterKey: dto.voterKey, picks },
      update: { picks },
      select: { id: true },
    });
    return { id: row.id };
  }

  // ---------------------------------------------------------- helpers --

  private async loadMeeting(meetingId: string): Promise<VotingMeeting> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: meetingVotingSelect,
    });
    if (!meeting) {
      throw new NotFoundException({
        code: 'MEETING_NOT_FOUND',
        message: 'No meeting matches that id',
      });
    }
    return meeting;
  }

  /** Same (id, token) gate as `PublicMeetingsController` — wrong id or wrong
   * token both fall out as the same opaque 404. */
  private async loadMeetingByToken(meetingId: string, token: string | undefined) {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: {
        id: true,
        clubId: true,
        meetingNumber: true,
        dateTime: true,
        theme: true,
        votingOpenedAt: true,
        votingClosedAt: true,
        club: { select: { name: true } },
      },
    });
    if (!meeting) {
      throw new NotFoundException('No meeting matches that share link');
    }
    return meeting;
  }

  private assertCan(subject: PermissionSubject, action: 'read' | 'update', clubId: string): void {
    if (!can(subject, action, 'meeting', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  /** Pull every category's candidates out of the meeting's own rows:
   * - best-prepared-speaker  ← prepared/keynote speaker slots (speaker side)
   * - best-evaluator         ← the evaluators attached to those slots
   * - best-table-topics-speaker ← the Timer's Table Topic speakers plus
   *   everyone checked in present (see `deriveTableTopicsCandidates`). This
   *   one also tops itself up on every read (see `syncAutoCategories`); both
   *   paths share the same derivation.
   * - best-role-taker        ← assigned meeting role holders */
  private async deriveCandidates(
    clubId: string,
    meetingId: string,
  ): Promise<Map<VoteCategoryKey, DerivedCandidate[]>> {
    const [speakers, roleRows, tableTopics] = await Promise.all([
      this.prisma.meetingSpeaker.findMany({
        where: { clubId, meetingId },
        select: {
          membership: { select: { id: true, firstName: true, lastName: true } },
          guest: { select: { id: true, firstName: true, lastName: true } },
          evaluatorMembership: { select: { id: true, firstName: true, lastName: true } },
          evaluatorGuest: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.meetingRoleAssignment.findMany({
        where: { clubId, meetingId },
        select: {
          membership: { select: { id: true, firstName: true, lastName: true } },
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.deriveTableTopicsCandidates(clubId, meetingId),
    ]);

    const derived = new Map<VoteCategoryKey, DerivedCandidate[]>([
      ['best-prepared-speaker', []],
      ['best-evaluator', []],
      ['best-table-topics-speaker', tableTopics],
      ['best-role-taker', []],
    ]);

    for (const speaker of speakers) {
      pushPerson(derived.get('best-prepared-speaker'), speaker.membership, speaker.guest);
      pushPerson(
        derived.get('best-evaluator'),
        speaker.evaluatorMembership,
        speaker.evaluatorGuest,
      );
    }
    for (const row of roleRows) {
      pushPerson(derived.get('best-role-taker'), row.membership, row.guest);
    }
    return derived;
  }

  /** Who might win Best Table Topics Speaker: everyone the Timer timed as a
   * "Table Topic" speaker, plus everyone checked in present (members and
   * guests). Either source alone is enough — a club that skips attendance
   * still gets the speakers, and one that skips the Timer still gets the
   * room. Officers prune or add by hand from there. */
  private async deriveTableTopicsCandidates(
    clubId: string,
    meetingId: string,
  ): Promise<DerivedCandidate[]> {
    const [timerRow, memberAttendance, guestAttendance] = await Promise.all([
      this.prisma.meetingRoleState.findUnique({
        where: { meetingId_kind: { meetingId, kind: 'timer' } },
        select: { clubId: true, state: true },
      }),
      this.prisma.meetingAttendance.findMany({
        where: { clubId, meetingId, present: true },
        select: {
          membership: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.meetingGuestAttendance.findMany({
        where: { clubId, meetingId, present: true },
        select: {
          name: true,
          guest: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const candidates: DerivedCandidate[] =
      timerRow && timerRow.clubId === clubId
        ? await this.verifiedTimerSpeakers(clubId, timerRow.state)
        : [];
    for (const row of memberAttendance) {
      pushPerson(candidates, row.membership, null);
    }
    for (const row of guestAttendance) {
      if (row.guest) {
        pushPerson(candidates, null, row.guest);
      } else if (row.name.trim()) {
        /* Legacy free-text row with no Prospect link — the snapshot name is
         * all there is, and all the ballot needs. */
        candidates.push({ name: row.name.trim() });
      }
    }
    return candidates;
  }

  /** The Timer's Table Topic speakers with their roster links checked
   * against this club. The Timer state is client-written JSON, so a stale or
   * foreign id would otherwise break the insert on the composite foreign
   * key — and this runs on every ballot read. An unknown link keeps the
   * typed name and drops the link. */
  private async verifiedTimerSpeakers(clubId: string, state: unknown) {
    const speakers = tableTopicsSpeakersFromTimerState(state);
    if (speakers.length === 0) return [];

    const membershipIds = [
      ...new Set(speakers.map((s) => s.membershipId).filter((id): id is string => !!id)),
    ];
    const guestIds = [
      ...new Set(speakers.map((s) => s.guestId).filter((id): id is string => !!id)),
    ];
    const [members, guests] = await Promise.all([
      membershipIds.length
        ? this.prisma.membership.findMany({
            where: { clubId, id: { in: membershipIds } },
            select: { id: true },
          })
        : [],
      guestIds.length
        ? this.prisma.prospect.findMany({
            where: { clubId, id: { in: guestIds } },
            select: { id: true },
          })
        : [],
    ]);
    const validMembers = new Set(members.map((m) => m.id));
    const validGuests = new Set(guests.map((g) => g.id));

    return speakers.map((speaker): DerivedCandidate => {
      if (speaker.membershipId && validMembers.has(speaker.membershipId)) {
        return { name: speaker.name, membershipId: speaker.membershipId };
      }
      if (speaker.guestId && validGuests.has(speaker.guestId)) {
        return { name: speaker.name, guestId: speaker.guestId };
      }
      return { name: speaker.name };
    });
  }

  /** Self-topping categories (today: best-table-topics-speaker) add anyone
   * new from meeting data on every read that serves them — the officer
   * setup view, the results board, and the public ballot alike. Only ever
   * ADDS, and never re-adds a name an officer removed: `existing` includes
   * removed rows on purpose. */
  private async syncAutoCategories(clubId: string, meetingId: string) {
    const category: VoteCategoryKey = 'best-table-topics-speaker';
    const people = await this.deriveTableTopicsCandidates(clubId, meetingId);
    if (people.length === 0) return;

    const existing = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId, meetingId, category },
      select: { name: true, membershipId: true, guestId: true },
    });
    const seen = new Set(
      existing.flatMap((row) => dedupeKeys(category, row.membershipId, row.guestId, row.name)),
    );

    const creates: {
      clubId: string;
      meetingId: string;
      category: string;
      name: string;
      membershipId?: string;
      guestId?: string;
      source: 'auto';
    }[] = [];
    for (const person of people) {
      const keys = dedupeKeys(category, person.membershipId, person.guestId, person.name);
      if (keys.some((key) => seen.has(key))) continue;
      for (const key of keys) seen.add(key);
      creates.push({
        clubId,
        meetingId,
        category,
        name: person.name,
        membershipId: person.membershipId,
        guestId: person.guestId,
        source: 'auto',
      });
    }

    if (creates.length > 0) {
      await this.prisma.meetingVoteCandidate.createMany({ data: creates, skipDuplicates: true });
    }
  }

  /** Officer-supplied roster links must point at this club's rows — the
   * composite FK would catch a cross-tenant pair at the DB level anyway,
   * but a bare membership id from another club would sail through it. */
  private async assertRosterLinks(clubId: string, candidates: VoteCandidateInputDto[]) {
    const membershipIds = [...new Set(candidates.map((c) => c.membershipId).filter(Boolean))];
    const guestIds = [...new Set(candidates.map((c) => c.guestId).filter(Boolean))];
    const [members, guests] = await Promise.all([
      membershipIds.length
        ? this.prisma.membership.findMany({
            where: { clubId, id: { in: membershipIds as string[] } },
            select: { id: true },
          })
        : [],
      guestIds.length
        ? this.prisma.prospect.findMany({
            where: { clubId, id: { in: guestIds as string[] } },
            select: { id: true },
          })
        : [],
    ]);
    const validMembers = new Set(members.map((m) => m.id));
    const validGuests = new Set(guests.map((g) => g.id));
    for (const candidate of candidates) {
      if (candidate.membershipId && !validMembers.has(candidate.membershipId)) {
        throw new BadRequestException({
          code: 'UNKNOWN_CANDIDATE_MEMBER',
          message: `${candidate.name} is not on this club's roster`,
        });
      }
      if (candidate.guestId && !validGuests.has(candidate.guestId)) {
        throw new BadRequestException({
          code: 'UNKNOWN_CANDIDATE_GUEST',
          message: `${candidate.name} is not in this club's guest list`,
        });
      }
    }
  }

  /** Lifecycle + WhatsApp state. The recipient count is only worked out
   * while it can still matter (sender linked, link not sent, not closed). */
  private async readStatus(meeting: VotingMeeting): Promise<MeetingVotingStatusWire> {
    const state = votingStateOf(meeting);
    const available = this.notifications.whatsappAvailable;
    const recipients =
      available && !meeting.votingLinkSentAt && state !== 'closed'
        ? (await this.notifications.votingRecipients(meeting.clubId, meeting.id)).length
        : 0;
    return {
      state,
      openedAt: meeting.votingOpenedAt?.toISOString() ?? null,
      closedAt: meeting.votingClosedAt?.toISOString() ?? null,
      whatsapp: {
        available,
        recipients,
        sentAt: meeting.votingLinkSentAt?.toISOString() ?? null,
        delivery: this.notifications.votingDelivery(meeting.id),
      },
    };
  }

  private async readSetup(meeting: VotingMeeting): Promise<MeetingVoteSetupWire> {
    const { clubId, id: meetingId } = meeting;
    const rows = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId, meetingId, removedAt: null },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        category: true,
        name: true,
        source: true,
        membershipId: true,
        guestId: true,
      },
    });

    const categories: VoteCategoryWire[] = VOTE_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      question: category.question,
      candidates: [],
    }));
    const byKey = new Map(categories.map((c) => [c.key, c] as const));
    for (const row of rows) {
      byKey.get(row.category as VoteCategoryKey)?.candidates.push({
        id: row.id,
        category: row.category,
        name: row.name,
        source: row.source,
        membershipId: row.membershipId,
        guestId: row.guestId,
      });
    }
    return { categories, status: await this.readStatus(meeting) };
  }
}

/** Dedupe identities for one candidate within a category: the roster link
 * when there is one (a rename doesn't fool it) and always the folded name —
 * the unique index is per name, and the Timer may hold the same person as a
 * typed name that attendance holds as a roster link. Two entries match when
 * any key is shared. */
function dedupeKeys(
  category: string,
  membershipId: string | null | undefined,
  guestId: string | null | undefined,
  name: string,
): string[] {
  const keys = [`${category}|n:${normalizeCandidateName(name)}`];
  if (membershipId) keys.push(`${category}|m:${membershipId}`);
  if (guestId) keys.push(`${category}|g:${guestId}`);
  return keys;
}

/** Append a member- or guest-shaped person to a derived list, skipping
 * empties. Dedup across the list is the caller's job (`dedupeKey`). */
function pushPerson(
  list: DerivedCandidate[] | undefined,
  member: { id: string; firstName: string; lastName: string } | null,
  guest: { id: string; firstName: string; lastName: string } | null,
): void {
  if (!list) return;
  if (member) {
    const name = fullName(member);
    if (name) list.push({ name, membershipId: member.id });
    return;
  }
  if (guest) {
    const name = fullName(guest);
    if (name) list.push({ name, guestId: guest.id });
  }
}

function groupPublicCandidates(
  rows: { id: string; category: string; name: string }[],
): PublicMeetingVoteWire['categories'] {
  const categories: PublicMeetingVoteWire['categories'] = VOTE_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    question: category.question,
    candidates: [],
  }));
  const byKey = new Map(categories.map((c) => [c.key, c] as const));
  for (const row of rows) {
    byKey.get(row.category as VoteCategoryKey)?.candidates.push({ id: row.id, name: row.name });
  }
  return categories;
}
