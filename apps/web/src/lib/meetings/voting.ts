/** Meeting voting ("best of the meeting" awards) — category catalogue, wire
 * types, and the voter-key helpers the anonymous ballot page uses.
 *
 * `VOTE_CATEGORIES` is string-identical to the API's copy in
 * `apps/api/src/meetings/voting.ts` — the two are the same contract on both
 * ends of the wire, kept as plain strings so a new award is a code change,
 * not a migration. */

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

/** One dropdown option, as the authenticated setup read serves it. The
 * roster links let the Voting tab de-dupe visually; the public ballot never
 * sees them (see `PublicVoteCandidate`). */
export interface VoteCandidate {
  id: string;
  category: string;
  name: string;
  /** `auto` (derived from meeting data) or `manual` (added by hand). */
  source: string;
  membershipId: string | null;
  guestId: string | null;
}

export interface PublicVoteCandidate {
  id: string;
  name: string;
}

export interface VoteCategory<Candidate = VoteCandidate> {
  key: VoteCategoryKey;
  label: string;
  question: string;
  candidates: Candidate[];
}

/** `GET /meetings/:id/vote/candidates` — the Voting tab's setup view. */
export interface MeetingVoteSetup {
  categories: VoteCategory[];
}

export interface VoteCategoryResults {
  key: VoteCategoryKey;
  label: string;
  question: string;
  /** Ballots that cast a (still valid) pick in this category. */
  totalVotes: number;
  candidates: { id: string; name: string; votes: number }[];
}

/** `GET /meetings/:id/vote/results` — the live tally. */
export interface MeetingVoteResults {
  totalBallots: number;
  categories: VoteCategoryResults[];
}

/** `GET /public/meetings/:id/vote?t=` — the anonymous ballot page's whole
 * payload: header, questions, options, and this device's previous picks when
 * it passed its voter key back. */
export interface PublicMeetingVote {
  meeting: {
    id: string;
    meetingNumber: number;
    dateTime: string;
    theme: string;
    clubName: string;
  };
  categories: VoteCategory<PublicVoteCandidate>[];
  picks: Record<string, string> | null;
}

/** Body for `PUT /meetings/:id/vote/candidates/:category` — replaces the
 * category's list. */
export interface SetVoteCandidatesInput {
  candidates: { name: string; membershipId?: string; guestId?: string }[];
}

/** Body for `POST /public/meetings/:id/vote`. */
export interface SubmitPublicVoteInput {
  meetingId: string;
  token: string;
  voterKey: string;
  picks: Record<string, string>;
}

/* ---------------------------------------------------------- voter key --
 * Anonymity with one-vote-per-device: the browser mints a random key the
 * first time the ballot opens and keeps it in localStorage. The server
 * upserts on (meeting, voterKey), so a resubmission from the same browser
 * replaces the earlier ballot instead of stacking. The key is random — it
 * identifies a device, never a person, and nothing else about the voter is
 * collected. */

const VOTER_KEY_PREFIX = 'toastly:vote:';

function voterKeyStorageKey(meetingId: string): string {
  return `${VOTER_KEY_PREFIX}${meetingId}`;
}

/** This device's voter key for the meeting, creating and persisting it on
 * first read. Returns '' during SSR — the ballot page only ever runs this
 * in the browser. */
export function ensureVoterKey(meetingId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const key = voterKeyStorageKey(meetingId);
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    /* Private-mode Safari throws on localStorage writes — fall back to a
     * session-only key so voting still works; a resubmit just can't find
     * the earlier ballot. */
    return `ephemeral-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** The picks this device last submitted, for instant prefill before the
 * server answers. Best-effort cache — the server-stored ballot (looked up
 * by voter key) is the source of truth. */
export function readLocalPicks(meetingId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(`${voterKeyStorageKey(meetingId)}:picks`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const picks: Record<string, string> = {};
    for (const [category, candidateId] of Object.entries(parsed)) {
      if (typeof candidateId === 'string') picks[category] = candidateId;
    }
    return picks;
  } catch {
    return {};
  }
}

export function writeLocalPicks(meetingId: string, picks: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${voterKeyStorageKey(meetingId)}:picks`, JSON.stringify(picks));
  } catch {
    // Best-effort cache — storage being unavailable only loses the prefill.
  }
}
