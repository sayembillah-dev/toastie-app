import type { Assignee, PlannerRow } from '@/lib/education/planner';

/**
 * The bridge from a planner row to a meeting. The planner is where the VPE
 * blocks out a term at a time; creating a meeting from a row carries those
 * assignments across so nobody re-enters them on the Roles and Speakers tabs.
 */

/** Planner column → the role key the Roles tab and the agenda both read.
 * `president` and `sergeant-at-arms` have no planner column, so they stay
 * unassigned and get filled in on the meeting itself. */
export const ROLE_BY_FIELD: Array<[keyof PlannerRow, string]> = [
  ['tmod', 'toastmaster'],
  ['ttm', 'table-topic-master'],
  ['ttEvaluator', 'table-topic-evaluator'],
  ['generalEvaluator', 'general-evaluator'],
  ['timer', 'timer'],
  ['ahCounter', 'ah-counter'],
  ['grammarian', 'grammarian'],
  ['harkmaster', 'harkmaster'],
];

/** The four speaker/evaluator pairs, in agenda order. */
const SPEAKER_PAIRS: Array<[keyof PlannerRow, keyof PlannerRow]> = [
  ['speaker1', 'evaluator1'],
  ['speaker2', 'evaluator2'],
  ['speaker3', 'evaluator3'],
  ['speaker4', 'evaluator4'],
];

/** Who a slot resolves to on the meeting side — a member or a roster guest.
 * A typed, not-yet-in-the-roster guest (`guestId` absent) has nothing to
 * point a foreign key at, so it resolves to `undefined` here same as an
 * empty slot. */
export interface PersonRef {
  membershipId?: string;
  guestId?: string;
}

export interface SpeakerSeed {
  speaker?: PersonRef;
  evaluator?: PersonRef;
}

export interface MeetingSeed {
  /** Role key → who's holding it. */
  roles: Record<string, PersonRef>;
  speakers: SpeakerSeed[];
}

function assigneeOf(row: PlannerRow, field: keyof PlannerRow): Assignee | null {
  return (row[field] as Assignee | null) ?? null;
}

function personRefOf(row: PlannerRow, field: keyof PlannerRow): PersonRef | undefined {
  const assignee = assigneeOf(row, field);
  if (!assignee) return undefined;
  if (assignee.kind === 'member') return { membershipId: assignee.memberId };
  if (assignee.guestId) return { guestId: assignee.guestId };
  return undefined;
}

export function buildMeetingSeed(row: PlannerRow): MeetingSeed {
  const roles: Record<string, PersonRef> = {};
  for (const [field, roleKey] of ROLE_BY_FIELD) {
    const ref = personRefOf(row, field);
    if (ref) roles[roleKey] = ref;
  }

  /* Only pairs holding an actual speaker become speaker cards — an evaluator
   * picked ahead of a speaker isn't a booked speech, and three empty slots on
   * the Prepared Speakers tab would be worse than none. */
  const speakers: SpeakerSeed[] = [];
  for (const [speakerField, evaluatorField] of SPEAKER_PAIRS) {
    const speaker = personRefOf(row, speakerField);
    if (!speaker) continue;
    const evaluator = personRefOf(row, evaluatorField);
    speakers.push({ speaker, evaluator });
  }

  return { roles, speakers };
}

/** How many slots on the row are held by a guest with no roster entry —
 * nothing for the meeting draft to link to, since it keys people by member
 * or guest id. */
export function countUnlinkedGuestAssignees(row: PlannerRow): number {
  const fields = [...ROLE_BY_FIELD.map(([field]) => field), ...SPEAKER_PAIRS.flat()];
  return fields.filter((field) => {
    const assignee = assigneeOf(row, field);
    return assignee?.kind === 'guest' && !assignee.guestId;
  }).length;
}
