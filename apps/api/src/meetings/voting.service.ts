import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import type {
  SetVoteCandidatesDto,
  SubmitPublicVoteDto,
  VoteCandidateInputDto,
} from './dto/voting.dto';
import {
  fullName,
  isVoteCategoryKey,
  type MeetingVoteResultsWire,
  type MeetingVoteSetupWire,
  normalizeCandidateName,
  type PublicMeetingVoteWire,
  VOTE_CATEGORIES,
  type VoteCategoryKey,
  type VoteCategoryResultsWire,
  type VoteCategoryWire,
} from './voting';

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
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------- authed --

  async listCandidates(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'read', meeting.clubId);
    return this.readSetup(meeting.clubId, meetingId);
  }

  /** "Sync from meeting data" — derive each category's candidates from what
   * the meeting already knows (speakers, evaluators, present attendees, role
   * holders) and insert the ones not already on the ballot. Never removes
   * anything: officer edits and manual additions survive a sync, and a
   * re-sync after the agenda changes only tops the lists up. */
  async syncCandidates(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'update', meeting.clubId);
    const clubId = meeting.clubId;

    const derived = await this.deriveCandidates(clubId, meetingId);
    const existing = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId, meetingId },
      select: { category: true, name: true, membershipId: true, guestId: true },
    });

    /* A candidate is "already there" when it matches on the roster link
     * (same person, renamed) or, failing a link, on the folded name. */
    const seen = new Set(
      existing.map((row) => dedupeKey(row.category, row.membershipId, row.guestId, row.name)),
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
        const key = dedupeKey(category, person.membershipId, person.guestId, person.name);
        if (seen.has(key)) continue;
        seen.add(key);
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
    return this.readSetup(clubId, meetingId);
  }

  /** Replace one category's candidate list with the officer's edit. Rows
   * whose name survived the edit keep their id — and therefore the votes
   * already cast for them; removed names take their picks out of the tally
   * (the ballots themselves are untouched). */
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
      const existing = await tx.meetingVoteCandidate.findMany({
        where: { clubId, meetingId, category },
        select: { id: true, name: true },
      });
      const existingByNorm = new Map(
        existing.map((row) => [normalizeCandidateName(row.name), row] as const),
      );

      const deleteIds = existing
        .filter((row) => !incoming.has(normalizeCandidateName(row.name)))
        .map((row) => row.id);
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

      if (deleteIds.length > 0) {
        await tx.meetingVoteCandidate.deleteMany({ where: { id: { in: deleteIds } } });
      }
      if (toCreate.length > 0) {
        await tx.meetingVoteCandidate.createMany({ data: toCreate, skipDuplicates: true });
      }
    });

    return this.readSetup(clubId, meetingId);
  }

  async getResults(subject: PermissionSubject, meetingId: string): Promise<MeetingVoteResultsWire> {
    const meeting = await this.loadMeeting(meetingId);
    this.assertCan(subject, 'read', meeting.clubId);

    const [candidates, ballots] = await Promise.all([
      this.prisma.meetingVoteCandidate.findMany({
        where: { clubId: meeting.clubId, meetingId },
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
    return { totalBallots: ballots.length, categories };
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

    const [candidates, ballot] = await Promise.all([
      this.prisma.meetingVoteCandidate.findMany({
        where: { clubId: meeting.clubId, meetingId },
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

    const candidates = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId: meeting.clubId, meetingId },
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

  private async loadMeeting(meetingId: string): Promise<{ id: string; clubId: string }> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, clubId: true },
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
   * - best-table-topics-speaker ← everyone checked in present (members and
   *   guests) — table topics is open floor, so attendance is the universe;
   *   officers prune the list on the Voting tab
   * - best-role-taker        ← assigned meeting role holders */
  private async deriveCandidates(
    clubId: string,
    meetingId: string,
  ): Promise<Map<VoteCategoryKey, DerivedCandidate[]>> {
    const [speakers, roleRows, memberAttendance, guestAttendance] = await Promise.all([
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

    const derived = new Map<VoteCategoryKey, DerivedCandidate[]>([
      ['best-prepared-speaker', []],
      ['best-evaluator', []],
      ['best-table-topics-speaker', []],
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
    for (const row of memberAttendance) {
      pushPerson(derived.get('best-table-topics-speaker'), row.membership, null);
    }
    for (const row of guestAttendance) {
      if (row.guest) {
        pushPerson(derived.get('best-table-topics-speaker'), null, row.guest);
      } else if (row.name.trim()) {
        /* Legacy free-text row with no Prospect link — the snapshot name is
         * all there is, and all the ballot needs. */
        derived.get('best-table-topics-speaker')?.push({ name: row.name.trim() });
      }
    }
    return derived;
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

  private async readSetup(clubId: string, meetingId: string): Promise<MeetingVoteSetupWire> {
    const rows = await this.prisma.meetingVoteCandidate.findMany({
      where: { clubId, meetingId },
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
    return { categories };
  }
}

/** Dedupe identity for one candidate within a category: the roster link when
 * there is one (a rename doesn't fool it), the folded name otherwise. */
function dedupeKey(
  category: string,
  membershipId: string | null | undefined,
  guestId: string | null | undefined,
  name: string,
): string {
  if (membershipId) return `${category}|m:${membershipId}`;
  if (guestId) return `${category}|g:${guestId}`;
  return `${category}|n:${normalizeCandidateName(name)}`;
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
