/** Shared vocabulary for the meeting voting feature ("best of the meeting"
 * awards) — category catalogue, wire shapes, and the small name helpers both
 * the service and the seeding logic lean on.
 *
 * The category list is string-identical to `VOTE_CATEGORIES` in the web's
 * `lib/meetings/voting.ts`. Kept as plain strings (like
 * `MeetingRoleAssignment.roleKey`) rather than a Prisma enum so a new award
 * is a code change on both ends, not a migration. */

export const VOTE_CATEGORIES = [
  {
    key: 'best-prepared-speaker',
    label: 'Best Prepared Speaker',
    question: 'Who is the best prepared speaker?',
  },
  {
    key: 'best-evaluator',
    label: 'Best Speech Evaluator',
    question: 'Who is the best prepared speech evaluator?',
  },
  {
    key: 'best-table-topics-speaker',
    label: 'Best Table Topics Speaker',
    question: 'Who is the best table topic speaker?',
    /* Table topics is open floor, so nobody is booked in advance. The
     * service tops this list up on every read from the Timer's "Table Topic"
     * speakers and from attendance; officers can still add or remove anyone
     * by hand, and a removed name stays removed. `auto` marks that top-up. */
    auto: true,
  },
  {
    key: 'best-role-taker',
    label: 'Best Role Taker',
    question: 'Who is the best role taker?',
  },
] as const;

export type VoteCategoryKey = (typeof VOTE_CATEGORIES)[number]['key'];

export function isVoteCategoryKey(value: string): value is VoteCategoryKey {
  return (VOTE_CATEGORIES as readonly { key: string }[]).some((entry) => entry.key === value);
}

/** Does this category top itself up on every read (Timer + attendance)?
 * It stays fully editable either way. */
export function isAutoVoteCategory(key: string): boolean {
  return (VOTE_CATEGORIES as readonly { key: string; auto?: boolean }[]).some(
    (entry) => entry.key === key && entry.auto === true,
  );
}

/** Candidate source marker — `auto` rows came from a "Sync from meeting
 * data" derivation, `manual` rows were typed in on the Voting tab. */
export const VOTE_CANDIDATE_SOURCES = ['auto', 'manual'] as const;

/** One dropdown option. `membershipId`/`guestId` ride along on the
 * authenticated management read (the Voting tab shows roster chips); the
 * public ballot strips them — see `toPublicCandidate`. */
export interface VoteCandidateWire {
  id: string;
  category: string;
  name: string;
  source: string;
  membershipId: string | null;
  guestId: string | null;
}

export interface PublicVoteCandidateWire {
  id: string;
  name: string;
}

export interface VoteCategoryWire<Candidate = VoteCandidateWire> {
  key: VoteCategoryKey;
  label: string;
  question: string;
  candidates: Candidate[];
}

/** Where the meeting's vote stands. `setup` = Start not pressed yet (ballots
 * are still accepted, so clients that predate the lifecycle keep working);
 * `open` = Start pressed; `closed` = Close pressed — the only state that
 * refuses ballots. */
export const VOTING_STATES = ['setup', 'open', 'closed'] as const;
export type VotingState = (typeof VOTING_STATES)[number];

export function votingStateOf(meeting: {
  votingOpenedAt: Date | null;
  votingClosedAt: Date | null;
}): VotingState {
  if (meeting.votingClosedAt) return 'closed';
  return meeting.votingOpenedAt ? 'open' : 'setup';
}

/** Delivery of the WhatsApp voting link, counted in memory by the
 * notifications outbox — null when nothing went out, or after an API restart
 * (the outbox isn't persisted either). */
export interface VotingLinkDeliveryWire {
  queued: number;
  sent: number;
  failed: number;
}

/** `GET /meetings/:id/vote/status`, and the `status` riding on the setup and
 * results reads. */
export interface MeetingVotingStatusWire {
  state: VotingState;
  openedAt: string | null;
  closedAt: string | null;
  whatsapp: {
    /** The WhatsApp sender is configured on this server. */
    available: boolean;
    /** People checked in present with a usable WhatsApp number — who Start
     * would message right now. */
    recipients: number;
    /** When the link went out — set once, so Start after a reopen won't
     * resend. */
    sentAt: string | null;
    delivery: VotingLinkDeliveryWire | null;
  };
}

/** Body of `POST /meetings/:id/vote/open` — the result of Start / Reopen. */
export interface OpenVotingResultWire {
  status: MeetingVotingStatusWire;
  /** WhatsApp messages queued by this call (0 when unticked, already sent,
   * not configured, or nobody to message). */
  whatsappQueued: number;
}

/** `GET /meetings/:id/vote/candidates` — the Voting tab's setup view: every
 * category with its current candidate list (possibly empty). */
export interface MeetingVoteSetupWire {
  categories: VoteCategoryWire[];
  status: MeetingVotingStatusWire;
}

/** `GET /meetings/:id/vote/results` — the live tally. Candidates with zero
 * votes are included so the board shows the full ballot; picks pointing at a
 * since-removed candidate are dropped from the counts entirely. */
export interface VoteCategoryResultsWire {
  key: VoteCategoryKey;
  label: string;
  question: string;
  /** Ballots that cast a (still valid) pick in this category. */
  totalVotes: number;
  candidates: { id: string; name: string; votes: number }[];
}

export interface MeetingVoteResultsWire {
  /** Total ballots submitted for the meeting — the "N votes in" headline. */
  totalBallots: number;
  categories: VoteCategoryResultsWire[];
  status: MeetingVotingStatusWire;
}

/** `GET /public/meetings/:id/vote?t=` — everything the anonymous ballot page
 * renders: the meeting header, the four questions with their dropdown
 * options, and (when the browser passes its voter key back as `v`) the picks
 * it last submitted, so a re-vote starts prefilled. */
export interface PublicMeetingVoteWire {
  meeting: {
    id: string;
    meetingNumber: number;
    dateTime: string;
    theme: string;
    clubName: string;
  };
  categories: VoteCategoryWire<PublicVoteCandidateWire>[];
  picks: Record<string, string> | null;
  /** `closed` = the ballot shows "Voting has closed" and submits are refused. */
  state: VotingState;
}

type NamedPerson = { firstName: string; lastName: string } | null | undefined;

/** Same "first last" convention as `public-meetings.controller.ts`. */
export function fullName(person: NamedPerson): string {
  return person ? `${person.firstName} ${person.lastName}`.trim() : '';
}

/** Normalisation for name-keyed dedup: the unique index on
 * MeetingVoteCandidate is case-sensitive, so seeding/replacement compares on
 * this folded form instead of the raw string. */
export function normalizeCandidateName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Longest name accepted from the Timer's state blob — the blob is written by
 * clients (including the public role link), so it is never trusted as-is. */
const MAX_TIMER_NAME_LENGTH = 120;

/** The Timer speaker type a Table Topics answer is timed under — string-
 * identical to `TIMER_SPEAKER_TYPES` on web and Flutter. */
export const TIMER_TABLE_TOPIC_TYPE = 'Table Topic';

export interface TimerTableTopicSpeaker {
  name: string;
  membershipId?: string;
  guestId?: string;
}

/** Everyone the Timer timed as a Table Topics speaker, read defensively out
 * of the Timer's JSON state (`{ speakers: [{ name, type, memberId?,
 * guestId? }] }`). Anything malformed is skipped rather than thrown on —
 * this runs on every ballot read. Roster links are passed through
 * unchecked; the caller verifies them against the club. */
export function tableTopicsSpeakersFromTimerState(state: unknown): TimerTableTopicSpeaker[] {
  if (!state || typeof state !== 'object') return [];
  const speakers = (state as { speakers?: unknown }).speakers;
  if (!Array.isArray(speakers)) return [];

  const out: TimerTableTopicSpeaker[] = [];
  for (const raw of speakers) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    if (row.type !== TIMER_TABLE_TOPIC_TYPE) continue;
    const name = typeof row.name === 'string' ? row.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > MAX_TIMER_NAME_LENGTH) continue;
    const membershipId =
      typeof row.memberId === 'string' && row.memberId ? row.memberId : undefined;
    const guestId =
      !membershipId && typeof row.guestId === 'string' && row.guestId ? row.guestId : undefined;
    out.push({ name, membershipId, guestId });
  }
  return out;
}
