import type { Member } from '@/lib/education/members';

/** A slot on the agenda is either filled by a club member or by an invited
 * guest (someone not in the roster). The two shapes let the UI show the right
 * badge and, later, let the back-end resolve member IDs vs. free-text names. */
export type Assignee = { kind: 'member'; memberId: string } | { kind: 'guest'; name: string };

export interface PlannerRow {
  id: string;
  meetingNumber: number;
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

export function createEmptyRow(id: string, meetingNumber: number): PlannerRow {
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

export function assigneeLabel(assignee: Assignee | null, members: Member[]): string {
  if (!assignee) return '';
  if (assignee.kind === 'guest') return `${assignee.name} (Guest)`;
  const member = members.find((m) => m.id === assignee.memberId);
  return member ? `${member.firstName} ${member.lastName}` : 'Unknown member';
}
