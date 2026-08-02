import type { Member } from '@/lib/education/members';

/** A slot on the agenda is either filled by a club member or by an invited
 * guest (someone not in the roster). The two shapes let the UI show the right
 * badge and, later, let the back-end resolve member IDs vs. free-text names. */
export type Assignee = { kind: 'member'; memberId: string } | { kind: 'guest'; name: string };

/** The row fields that hold a person. Named as a type so the grid and the
 * create dialog can both drive their column lists off one list of keys. */
export type AssigneeField =
  | 'tmod'
  | 'ttm'
  | 'ttEvaluator'
  | 'speaker1'
  | 'evaluator1'
  | 'speaker2'
  | 'evaluator2'
  | 'speaker3'
  | 'evaluator3'
  | 'generalEvaluator'
  | 'timer'
  | 'ahCounter'
  | 'grammarian';

export interface PlannerRow {
  id: string;
  /** Typed in by the VPE, not derived: clubs number meetings on their own
   * scheme, and a planner row often sits in the calendar long before anyone
   * knows which number it lands on. `null` until they fill it in. */
  meetingNumber: number | null;
  /** Value from an <input type="datetime-local"> — "YYYY-MM-DDTHH:mm" or null. */
  dateTime: string | null;
  tmod: Assignee | null;
  ttm: Assignee | null;
  ttEvaluator: Assignee | null;
  speaker1: Assignee | null;
  evaluator1: Assignee | null;
  speaker2: Assignee | null;
  evaluator2: Assignee | null;
  speaker3: Assignee | null;
  evaluator3: Assignee | null;
  generalEvaluator: Assignee | null;
  timer: Assignee | null;
  ahCounter: Assignee | null;
  grammarian: Assignee | null;
  theme: string;
  notes: string;
}

export function createEmptyRow(id: string, meetingNumber: number | null = null): PlannerRow {
  return {
    id,
    meetingNumber,
    dateTime: null,
    tmod: null,
    ttm: null,
    ttEvaluator: null,
    speaker1: null,
    evaluator1: null,
    speaker2: null,
    evaluator2: null,
    speaker3: null,
    evaluator3: null,
    generalEvaluator: null,
    timer: null,
    ahCounter: null,
    grammarian: null,
    theme: '',
    notes: '',
  };
}

/** How a row refers to itself in aria labels and dialog titles before it has a
 * number of its own. */
export function plannerRowLabel(row: PlannerRow): string {
  return row.meetingNumber === null ? 'this planned meeting' : `meeting #${row.meetingNumber}`;
}

export function assigneeLabel(assignee: Assignee | null, members: Member[]): string {
  if (!assignee) return '';
  if (assignee.kind === 'guest') return `${assignee.name} (Guest)`;
  const member = members.find((m) => m.id === assignee.memberId);
  return member ? `${member.firstName} ${member.lastName}` : 'Unknown member';
}
