import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Membership } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { MEMBERSHIP_AVATAR_INCLUDE, type MemberWire, toMemberWire } from '@/memberships';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage';

import type { CreateSpeechSlotRequestDto, StartPathwayDto } from './dto/education.dto';
import {
  type AhCounterEntryWire,
  computeMemberStats,
  type DeliveredSpeakerRow,
  type EvaluationWire,
  type HistoryEventWire,
  type MemberStatsWire,
  type SpeechSlotRequestWire,
  type TimerEntryWire,
  toAhCounterEntryWire,
  toEvaluationWire,
  toHistoryEventWire,
  toSpeechGivenHistoryRow,
  toSpeechGivenWire,
  toSpeechSlotRequestWire,
  toTimerEntryWire,
} from './serializers';

/** The `/members/:memberId/…` endpoints — history, stats, evaluations,
 * timer/ah-counter reports, and speech-slot requests. Every method loads
 * the member first so it can run the fine `can()` check against the row's
 * own `clubId`, matching the two-phase pattern in `MembershipsService`. */
@Injectable()
export class EducationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** ---------------------------------------------------------- history -- */

  async listHistory(subject: PermissionSubject, memberId: string): Promise<HistoryEventWire[]> {
    const member = await this.assertEducationRead(subject, memberId);
    const [rows, speeches] = await Promise.all([
      this.prisma.historyEvent.findMany({
        where: { clubId: member.clubId, membershipId: member.id },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      }),
      this.loadDeliveredSpeeches(member.clubId, member.id),
    ]);
    const events = [...rows.map(toHistoryEventWire), ...speeches.map(toSpeechGivenWire)];
    events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return events;
  }

  async getStats(subject: PermissionSubject, memberId: string): Promise<MemberStatsWire> {
    const member = await this.assertEducationRead(subject, memberId);
    const [events, speeches] = await Promise.all([
      this.prisma.historyEvent.findMany({
        where: { clubId: member.clubId, membershipId: member.id },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
      }),
      this.loadDeliveredSpeeches(member.clubId, member.id),
    ]);
    // Meetings-attended is a baseline counter the club maintains; no route
    // increments it yet, so it falls back to the derived count of visit
    // logs bearing this member's user id. Missing → 0.
    const meetingsAttended = 0;
    const combined = [...events, ...speeches.map(toSpeechGivenHistoryRow)];
    return computeMemberStats(member, combined, meetingsAttended);
  }

  /** `MeetingSpeaker` rows for this member that count as a delivered speech
   * — either explicitly marked `delivered`, or already carrying at least one
   * evaluation submission (an evaluator wouldn't have anything to evaluate
   * otherwise, and organisers don't reliably flip the status dropdown).
   * Nothing currently writes a `speechGiven` `HistoryEvent` row, so this is
   * the real source of truth for "speeches given" on the Me page. */
  private async loadDeliveredSpeeches(
    clubId: string,
    membershipId: string,
  ): Promise<DeliveredSpeakerRow[]> {
    return this.prisma.meetingSpeaker.findMany({
      where: {
        clubId,
        membershipId,
        OR: [{ status: 'delivered' }, { evaluationSubmissions: { some: {} } }],
      },
      include: { meeting: { select: { meetingNumber: true, dateTime: true } } },
      orderBy: { meeting: { dateTime: 'desc' } },
    });
  }

  async startPathway(
    subject: PermissionSubject,
    memberId: string,
    dto: StartPathwayDto,
  ): Promise<MemberWire> {
    const member = await this.load(memberId);
    /* Club-scope managers (VPE/President/ClubAdmin) pass on their role grant;
     * any other member passes only for their own membership, via the
     * `own`-scoped grant in `MEMBER_ROLE` — the controller's coarse gate ran
     * before the row (and therefore its owner) was known. */
    if (
      !can(subject, 'update', 'education', {
        clubId: member.clubId,
        ownerMembershipId: member.id,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'education',
        action: 'update',
        reason: 'You can only manage your own pathway',
      });
    }
    if (dto.level < 1 || dto.level > 5) {
      throw new BadRequestException('level must be between 1 and 5');
    }
    const today = new Date();

    // Update the pathway columns on Membership and record a
    // `project-started` history event in one transaction — the web writes
    // both at once and the timeline breaks if they diverge.
    const [updated] = await this.prisma.$transaction([
      this.prisma.membership.update({
        where: { id: member.id },
        data: {
          pathway: dto.pathway,
          level: dto.level,
          startingLevel: dto.level,
          startedProject: dto.project,
          pathwayStartedAt: today,
        },
        include: MEMBERSHIP_AVATAR_INCLUDE,
      }),
      this.prisma.historyEvent.create({
        data: {
          clubId: member.clubId,
          membershipId: member.id,
          type: 'projectStarted',
          date: today,
          projectName: dto.project,
          level: dto.level,
          pathway: dto.pathway,
        },
      }),
    ]);

    return toMemberWire(updated, this.storage);
  }

  /** ---------------------------------------------------- speech reports -- */

  async listEvaluations(subject: PermissionSubject, memberId: string): Promise<EvaluationWire[]> {
    const member = await this.assertReportsRead(subject, memberId);
    const rows = await this.prisma.evaluation.findMany({
      where: { clubId: member.clubId, membershipId: member.id },
      orderBy: { date: 'desc' },
    });
    return rows.map(toEvaluationWire);
  }

  async listTimerEntries(subject: PermissionSubject, memberId: string): Promise<TimerEntryWire[]> {
    const member = await this.assertReportsRead(subject, memberId);
    const rows = await this.prisma.timerEntry.findMany({
      where: { clubId: member.clubId, membershipId: member.id },
      orderBy: { date: 'desc' },
    });
    return rows.map(toTimerEntryWire);
  }

  async listAhCounterEntries(
    subject: PermissionSubject,
    memberId: string,
  ): Promise<AhCounterEntryWire[]> {
    const member = await this.assertReportsRead(subject, memberId);
    const rows = await this.prisma.ahCounterEntry.findMany({
      where: { clubId: member.clubId, membershipId: member.id },
      orderBy: { date: 'desc' },
    });
    return rows.map(toAhCounterEntryWire);
  }

  /** ---------------------------------------------- speech slot requests -- */

  async listSpeechSlotRequests(
    subject: PermissionSubject,
    memberId: string,
  ): Promise<SpeechSlotRequestWire[]> {
    const member = await this.load(memberId);
    /* `own`-scoped read for the member themselves (the Me-page card lists
     * their own asks); anyone else needs the club-scoped grant (VPE/Admin). */
    if (
      !can(subject, 'read', 'speechRequest', {
        clubId: member.clubId,
        ownerMembershipId: member.id,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'speechRequest',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.speechSlotRequest.findMany({
      where: { clubId: member.clubId, membershipId: member.id },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map(toSpeechSlotRequestWire);
  }

  async createSpeechSlotRequest(
    subject: PermissionSubject,
    memberId: string,
    dto: CreateSpeechSlotRequestDto,
  ): Promise<SpeechSlotRequestWire> {
    const member = await this.load(memberId);
    /* The member creates requests for their own membership (`own`-scoped
     * grant); VPE/ClubAdmin can file one for anyone via the club grant.
     * A member targeting somebody else's membership id 403s here. */
    if (
      !can(subject, 'create', 'speechRequest', {
        clubId: member.clubId,
        ownerMembershipId: member.id,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'speechRequest',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    // Meeting must live in the same club — the local-db handler validates
    // this the same way (`readMeetings().some(...)`).
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: dto.meetingId },
      select: { id: true, clubId: true },
    });
    if (!meeting || meeting.clubId !== member.clubId) {
      throw new BadRequestException(`No meeting with id "${dto.meetingId}"`);
    }

    const row = await this.prisma.speechSlotRequest.create({
      data: {
        clubId: member.clubId,
        membershipId: member.id,
        meetingId: dto.meetingId,
        projectName: dto.projectName?.trim() || null,
        note: dto.note?.trim() || null,
        status: 'pending',
      },
    });
    return toSpeechSlotRequestWire(row);
  }

  /** ----------------------------------------------------------- helpers -- */

  private async load(memberId: string): Promise<Membership> {
    const row = await this.prisma.membership.findUnique({ where: { id: memberId } });
    if (!row) throw new NotFoundException(`No member with id "${memberId}"`);
    return row;
  }

  private async assertEducationRead(
    subject: PermissionSubject,
    memberId: string,
  ): Promise<Membership> {
    const member = await this.load(memberId);
    if (!can(subject, 'read', 'education', { clubId: member.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'education',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    return member;
  }

  private async assertReportsRead(
    subject: PermissionSubject,
    memberId: string,
  ): Promise<Membership> {
    const member = await this.load(memberId);
    /* `ownerMembershipId` is what lets a plain member through on their own
     * reports (`evaluation:read` is `own`-scoped in MEMBER_ROLE) while every
     * other member still 403s; VPE/ClubAdmin pass on the club-scoped grant. */
    if (
      !can(subject, 'read', 'evaluation', {
        clubId: member.clubId,
        ownerMembershipId: member.id,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'evaluation',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    return member;
  }
}
