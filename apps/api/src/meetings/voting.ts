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

/** `GET /meetings/:id/vote/candidates` — the Voting tab's setup view: every
 * category with its current candidate list (possibly empty). */
export interface MeetingVoteSetupWire {
  categories: VoteCategoryWire[];
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
