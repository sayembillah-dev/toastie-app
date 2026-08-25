import type { Member } from '@/lib/education/members';

/** A slot on the agenda is either filled by a club member or by a guest.
 * A guest is either someone already in the club's Guests roster (`guestId`
 * set — carries through to the meeting's own roles/speakers) or a one-off
 * name typed on the spot (`guestId` absent — nothing to link to, so it stays
 * planner-only, same as before guests had a roster). */
export type Assignee =
  | { kind: 'member'; memberId: string }
  | { kind: 'guest'; name: string; guestId?: string };

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
  | 'speaker4'
  | 'evaluator4'
  | 'generalEvaluator'
  | 'timer'
  | 'ahCounter'
  | 'grammarian';

/** Drives the wire (un)packing below — every assignee field, in no
 * particular order. */
const ASSIGNEE_FIELDS: AssigneeField[] = [
  'tmod',
  'ttm',
  'ttEvaluator',
  'speaker1',
  'evaluator1',
  'speaker2',
  'evaluator2',
  'speaker3',
  'evaluator3',
  'speaker4',
  'evaluator4',
  'generalEvaluator',
  'timer',
  'ahCounter',
  'grammarian',
];

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
  speaker4: Assignee | null;
  evaluator4: Assignee | null;
  generalEvaluator: Assignee | null;
  timer: Assignee | null;
  ahCounter: Assignee | null;
  grammarian: Assignee | null;
  theme: string;
  notes: string;
  /** Set once "Create meeting" succeeds — the join the grid uses to shade a
   * row green, replacing a fragile meetingNumber-matching heuristic. */
  meetingId: string | null;
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
    speaker4: null,
    evaluator4: null,
    generalEvaluator: null,
    timer: null,
    ahCounter: null,
    grammarian: null,
    theme: '',
    notes: '',
    meetingId: null,
  };
}

/** Wire shape from `GET/POST/PATCH /planner-rows` — `assignees` travels as
 * one JSON blob rather than 15 columns; `fromPlannerRowWire` unpacks it into
 * the flat shape every component already works with. */
export interface PlannerRowWire {
  id: string;
  meetingNumber: number | null;
  dateTime: string | null;
  theme: string;
  notes: string;
  assignees: Partial<Record<AssigneeField, Assignee | null>>;
  meetingId: string | null;
}

export interface UpdatePlannerRowInput {
  meetingNumber?: number | null;
  dateTime?: string | null;
  theme?: string;
  notes?: string;
  assignees?: Partial<Record<AssigneeField, Assignee | null>>;
  meetingId?: string | null;
}

function isAssignee(value: unknown): value is Assignee {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.kind === 'member') return typeof v.memberId === 'string';
  if (v.kind === 'guest') {
    return typeof v.name === 'string' && (v.guestId === undefined || typeof v.guestId === 'string');
  }
  return false;
}

export function fromPlannerRowWire(wire: PlannerRowWire): PlannerRow {
  const row = createEmptyRow(wire.id, wire.meetingNumber);
  row.dateTime = wire.dateTime;
  row.theme = wire.theme;
  row.notes = wire.notes;
  row.meetingId = wire.meetingId;
  for (const field of ASSIGNEE_FIELDS) {
    const value = wire.assignees[field];
    row[field] = isAssignee(value) ? value : null;
  }
  return row;
}

/** Packs the row's 15 assignee fields into the JSON shape the API stores. */
export function toAssigneesJson(row: PlannerRow): Partial<Record<AssigneeField, Assignee | null>> {
  const out: Partial<Record<AssigneeField, Assignee | null>> = {};
  for (const field of ASSIGNEE_FIELDS) out[field] = row[field];
  return out;
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

/** Stable identity for a slot's occupant — two calls return the same string
 * only when the same person holds both slots. Used by the planner grid to
 * flag someone taking the same role two meetings running. Members key on the
 * membership id; roster guests on their guest id; a typed-in guest with no
 * roster entry falls back to its trimmed lower-cased name, so re-typing the
 * same guest under matching-cased whitespace still matches. */
export function assigneeKey(assignee: Assignee | null): string | null {
  if (!assignee) return null;
  if (assignee.kind === 'member') return `m:${assignee.memberId}`;
  if (assignee.guestId) return `gid:${assignee.guestId}`;
  return `g:${assignee.name.trim().toLowerCase()}`;
}
