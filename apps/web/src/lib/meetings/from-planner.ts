import type { Assignee, PlannerRow } from '@/lib/education/planner';

/**
 * The bridge from a planner row to a meeting. The planner is where the VPE
 * blocks out a term at a time; creating a meeting from a row carries those
 * assignments across so nobody re-enters them on the Roles and Speakers tabs.
 */

/** Planner column → the role key the Roles tab and the agenda both read.
 * `president` and `sergeant-at-arms` have no planner column, so they stay
 * unassigned and get filled in on the meeting itself. */
const ROLE_BY_FIELD: Array<[keyof PlannerRow, string]> = [
  ['tmod', 'toastmaster'],
  ['ttm', 'table-topic-master'],
  ['ttEvaluator', 'table-topic-evaluator'],
  ['generalEvaluator', 'general-evaluator'],
  ['timer', 'timer'],
  ['ahCounter', 'ah-counter'],
  ['grammarian', 'grammarian'],
];

/** The three speaker/evaluator pairs, in agenda order. */
const SPEAKER_PAIRS: Array<[keyof PlannerRow, keyof PlannerRow]> = [
  ['speaker1', 'evaluator1'],
  ['speaker2', 'evaluator2'],
  ['speaker3', 'evaluator3'],
];

export interface SpeakerSeed {
  memberId?: string;
  evaluatorId?: string;
}

export interface MeetingSeed {
  /** Role key → member id. */
  roles: Record<string, string>;
  speakers: SpeakerSeed[];
}

function assigneeOf(row: PlannerRow, field: keyof PlannerRow): Assignee | null {
  return (row[field] as Assignee | null) ?? null;
}

/* The meeting draft identifies people by member id, so a guest booked in the
 * planner has nothing to map onto. `countGuestAssignees` exists so the create
 * dialog can say so out loud rather than dropping them silently. */
function memberIdOf(row: PlannerRow, field: keyof PlannerRow): string | undefined {
  const assignee = assigneeOf(row, field);
  return assignee?.kind === 'member' ? assignee.memberId : undefined;
}

export function buildMeetingSeed(row: PlannerRow): MeetingSeed {
  const roles: Record<string, string> = {};
  for (const [field, roleKey] of ROLE_BY_FIELD) {
    const memberId = memberIdOf(row, field);
    if (memberId) roles[roleKey] = memberId;
  }

  /* Only pairs with someone in them become speaker cards — three empty slots
   * on the Prepared Speakers tab would be worse than none. */
  const speakers: SpeakerSeed[] = [];
  for (const [speakerField, evaluatorField] of SPEAKER_PAIRS) {
    const memberId = memberIdOf(row, speakerField);
    const evaluatorId = memberIdOf(row, evaluatorField);
    if (memberId || evaluatorId) speakers.push({ memberId, evaluatorId });
  }

  return { roles, speakers };
}

/** How many slots on the row are held by a guest — none of which survive into
 * the meeting draft, since it keys everything by member id. */
export function countGuestAssignees(row: PlannerRow): number {
  const fields = [...ROLE_BY_FIELD.map(([field]) => field), ...SPEAKER_PAIRS.flat()];
  return fields.filter((field) => assigneeOf(row, field)?.kind === 'guest').length;
}
