/** A single "who did what, when" event, emitted whenever an officer or member
 * takes an action the club cares about tracking — logging a transaction,
 * checking off a checklist item, running a meeting, etc. This is the raw feed
 * the Activity Logs page renders; it is also the intended input for future
 * work this table is not yet doing: rolling activity up into an officer
 * activeness/compliance score, surfacing the same stream in other
 * dashboards, and an automatic points system feeding a leaderboard. */

export const ACTIVITY_CATEGORIES = [
  'meeting',
  'education',
  'finance',
  'inventory',
  'people',
  'library',
  'task',
  'org',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface ActivityLog {
  id: string;
  /** Tenant boundary — the club this event happened in. */
  clubId: string;
  /** The member who performed the action. */
  actorMemberId: string;
  category: ActivityCategory;
  /** Short verb phrase for compact contexts, e.g. "logged a transaction". */
  action: string;
  /** Full human-readable line rendered in the feed, e.g. "Logged an expense
   * — Venue deposit". */
  summary: string;
  /** What the action was performed on, when it maps to a row in another
   * table — not every action has one (e.g. starting a pathway). */
  entityType?: string;
  entityId?: string;
  /** Reserved for the future points/leaderboard system. Always 0 today —
   * nothing computes into it yet. */
  points: number;
  createdAt: string;
}

/** Latest-first, tie-broken by id so ordering is deterministic for React keys. */
export function sortActivityLogsNewestFirst(logs: ActivityLog[]): ActivityLog[] {
  return [...logs].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

export function matchesActivityLogQuery(log: ActivityLog, needle: string): boolean {
  return log.summary.toLowerCase().includes(needle);
}

/** Realistic spread of activity across every category and a handful of
 * different members, dated across the last couple of months — enough
 * variety to exercise every filter without turning this into a novel. Real
 * usage populates this table through `ActivityService.record()` in the
 * API; this seed just gives a returning user something to look at. */
export const SEED_ACTIVITY_LOGS: Omit<ActivityLog, 'clubId'>[] = [
  {
    id: 'act-001',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'logged a transaction',
    summary: 'Logged an expense — Venue deposit for August meetings',
    entityType: 'transaction',
    entityId: 'tx-venue-aug',
    points: 0,
    createdAt: '2026-06-02T14:12:00.000Z',
  },
  {
    id: 'act-002',
    actorMemberId: 'm-05',
    category: 'meeting',
    action: 'created a meeting',
    summary: 'Created the agenda for Meeting 45',
    entityType: 'meeting',
    entityId: 'mtg-045',
    points: 0,
    createdAt: '2026-06-03T09:30:00.000Z',
  },
  {
    id: 'act-003',
    actorMemberId: 'm-07',
    category: 'inventory',
    action: 'checked off a checklist item',
    summary: 'Checked off "Set up lectern and timer lights" for Meeting 45',
    entityType: 'checklistItem',
    points: 0,
    createdAt: '2026-06-03T20:45:00.000Z',
  },
  {
    id: 'act-004',
    actorMemberId: 'm-03',
    category: 'people',
    action: 'logged a guest visit',
    summary: 'Logged a visit — Mei Tanaka attended as a guest',
    entityType: 'visitLog',
    points: 0,
    createdAt: '2026-06-06T21:05:00.000Z',
  },
  {
    id: 'act-004b',
    actorMemberId: 'm-01',
    category: 'education',
    action: 'took a meeting role',
    summary: 'Signed up as General Evaluator for Meeting 35',
    entityType: 'historyEvent',
    points: 0,
    createdAt: '2026-06-08T18:00:00.000Z',
  },
  {
    id: 'act-005',
    actorMemberId: 'm-02',
    category: 'education',
    action: 'submitted an evaluation',
    summary: 'Submitted a written evaluation for Aisha Patel’s speech',
    entityType: 'evaluation',
    points: 0,
    createdAt: '2026-06-08T20:40:00.000Z',
  },
  {
    id: 'act-006',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'recorded a dues payment',
    summary: 'Recorded a dues payment from Hannah Klein',
    entityType: 'duesRecord',
    points: 0,
    createdAt: '2026-06-10T13:15:00.000Z',
  },
  {
    id: 'act-007',
    actorMemberId: 'm-04',
    category: 'people',
    action: 'logged a contact',
    summary: 'Logged a follow-up call with Jamal Osei',
    entityType: 'contactLog',
    points: 0,
    createdAt: '2026-06-11T16:20:00.000Z',
  },
  {
    id: 'act-008',
    actorMemberId: 'm-07',
    category: 'inventory',
    action: 'added an inventory item',
    summary: 'Added "Wireless lapel mic" to the inventory',
    entityType: 'inventoryItem',
    points: 0,
    createdAt: '2026-06-13T11:00:00.000Z',
  },
  {
    id: 'act-009',
    actorMemberId: 'm-05',
    category: 'library',
    action: 'uploaded a document',
    summary: 'Uploaded "June committee minutes" to the library',
    entityType: 'document',
    points: 0,
    createdAt: '2026-06-15T19:50:00.000Z',
  },
  {
    id: 'act-010',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'added a budget line',
    summary: 'Added a Q3 budget line — Contest venue hire',
    entityType: 'budgetLine',
    points: 0,
    createdAt: '2026-06-17T10:05:00.000Z',
  },
  {
    id: 'act-011',
    actorMemberId: 'm-09',
    category: 'education',
    action: 'requested a speech slot',
    summary: 'Requested a speech slot for Meeting 46',
    entityType: 'speechSlotRequest',
    points: 0,
    createdAt: '2026-06-18T22:10:00.000Z',
  },
  {
    id: 'act-012',
    actorMemberId: 'm-01',
    category: 'task',
    action: 'completed a task',
    summary: 'Completed "Review and sign off the Q3 budget"',
    entityType: 'task',
    entityId: 'task-m-01-3',
    points: 0,
    createdAt: '2026-06-20T15:30:00.000Z',
  },
  {
    id: 'act-013',
    actorMemberId: 'm-05',
    category: 'meeting',
    action: 'updated a meeting',
    summary: 'Updated the theme for Meeting 46 to "Bridges"',
    entityType: 'meeting',
    entityId: 'mtg-046',
    points: 0,
    createdAt: '2026-06-22T09:15:00.000Z',
  },
  {
    id: 'act-014',
    actorMemberId: 'm-07',
    category: 'inventory',
    action: 'checked off a checklist item',
    summary: 'Checked off "Count and lock the cash box" for Meeting 46',
    entityType: 'checklistItem',
    points: 0,
    createdAt: '2026-06-24T20:50:00.000Z',
  },
  {
    id: 'act-015',
    actorMemberId: 'm-03',
    category: 'people',
    action: 'logged a guest visit',
    summary: 'Logged a visit — Ada Onyekachi delivered her Ice Breaker as a guest',
    entityType: 'visitLog',
    points: 0,
    createdAt: '2026-06-24T21:40:00.000Z',
  },
  {
    id: 'act-016',
    actorMemberId: 'm-02',
    category: 'education',
    action: 'started a pathway',
    summary: 'Started the Effective Coaching pathway at Level 5',
    entityType: 'member',
    entityId: 'm-02',
    points: 0,
    createdAt: '2026-06-27T12:00:00.000Z',
  },
  {
    id: 'act-017',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'logged a transaction',
    summary: 'Logged income — District conference reimbursement',
    entityType: 'transaction',
    points: 0,
    createdAt: '2026-06-29T14:25:00.000Z',
  },
  {
    id: 'act-018',
    actorMemberId: 'm-04',
    category: 'library',
    action: 'added an asset',
    summary: 'Added "Club banner (large)" to the asset register',
    entityType: 'asset',
    points: 0,
    createdAt: '2026-07-01T17:10:00.000Z',
  },
  {
    id: 'act-019',
    actorMemberId: 'm-05',
    category: 'meeting',
    action: 'created a meeting',
    summary: 'Created the agenda for Meeting 47',
    entityType: 'meeting',
    entityId: 'mtg-047',
    points: 0,
    createdAt: '2026-07-04T09:00:00.000Z',
  },
  {
    id: 'act-020',
    actorMemberId: 'm-07',
    category: 'task',
    action: 'assigned a task',
    summary: 'Assigned "Confirm judges for the Humorous Speech contest" to Aisha Patel',
    entityType: 'task',
    entityId: 'task-m-01-2',
    points: 0,
    createdAt: '2026-07-06T13:45:00.000Z',
  },
  {
    id: 'act-021',
    actorMemberId: 'm-02',
    category: 'education',
    action: 'submitted an evaluation',
    summary: 'Submitted a written evaluation for Marcus Chen’s speech',
    entityType: 'evaluation',
    points: 0,
    createdAt: '2026-07-06T21:00:00.000Z',
  },
  {
    id: 'act-022',
    actorMemberId: 'm-03',
    category: 'people',
    action: 'logged a guest visit',
    summary: 'Logged a visit — Lucas Fernandez attended as a guest',
    entityType: 'visitLog',
    points: 0,
    createdAt: '2026-07-06T21:15:00.000Z',
  },
  {
    id: 'act-023',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'recorded a dues payment',
    summary: 'Recorded a dues payment from Rafael Mendoza',
    entityType: 'duesRecord',
    points: 0,
    createdAt: '2026-07-09T10:30:00.000Z',
  },
  {
    id: 'act-024',
    actorMemberId: 'm-07',
    category: 'inventory',
    action: 'updated an inventory item',
    summary: 'Marked "Portable PA speaker" as checked out for the contest',
    entityType: 'inventoryItem',
    points: 0,
    createdAt: '2026-07-12T18:20:00.000Z',
  },
  {
    id: 'act-025',
    actorMemberId: 'm-05',
    category: 'library',
    action: 'uploaded a document',
    summary: 'Uploaded "Humorous Speech contest rules" to the library',
    entityType: 'document',
    points: 0,
    createdAt: '2026-07-15T16:00:00.000Z',
  },
  {
    id: 'act-026',
    actorMemberId: 'm-01',
    category: 'task',
    action: 'completed a task',
    summary: 'Completed "Confirm judges for the Humorous Speech contest"',
    entityType: 'task',
    entityId: 'task-m-01-2',
    points: 0,
    createdAt: '2026-07-18T11:40:00.000Z',
  },
  {
    id: 'act-027',
    actorMemberId: 'm-04',
    category: 'people',
    action: 'logged a contact',
    summary: 'Logged an outreach email to Henrik Sørensen',
    entityType: 'contactLog',
    points: 0,
    createdAt: '2026-07-22T09:55:00.000Z',
  },
  {
    id: 'act-028',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'logged a transaction',
    summary: 'Logged an expense — Trophies for the Humorous Speech contest',
    entityType: 'transaction',
    points: 0,
    createdAt: '2026-07-25T15:10:00.000Z',
  },
  {
    id: 'act-029',
    actorMemberId: 'm-05',
    category: 'meeting',
    action: 'updated a meeting',
    summary: 'Added the contest schedule to Meeting 48',
    entityType: 'meeting',
    entityId: 'mtg-048',
    points: 0,
    createdAt: '2026-07-29T08:45:00.000Z',
  },
  {
    id: 'act-030',
    actorMemberId: 'm-02',
    category: 'education',
    action: 'submitted an evaluation',
    summary: 'Submitted a written evaluation for Marcus Chen’s speech',
    entityType: 'evaluation',
    points: 0,
    createdAt: '2026-08-01T20:30:00.000Z',
  },
  {
    id: 'act-031',
    actorMemberId: 'm-07',
    category: 'inventory',
    action: 'checked off a checklist item',
    summary: 'Checked off "Return the PA speaker to storage" for Meeting 48',
    entityType: 'checklistItem',
    points: 0,
    createdAt: '2026-08-01T21:50:00.000Z',
  },
  {
    id: 'act-032',
    actorMemberId: 'm-01',
    category: 'task',
    action: 'completed a task',
    summary: 'Completed "Review and sign off the Q3 budget"',
    entityType: 'task',
    points: 0,
    createdAt: '2026-08-03T12:00:00.000Z',
  },
  {
    id: 'act-033',
    actorMemberId: 'm-03',
    category: 'people',
    action: 'logged a guest visit',
    summary: 'Logged a visit — Elena Vasquez attended as a guest',
    entityType: 'visitLog',
    points: 0,
    createdAt: '2026-08-04T21:05:00.000Z',
  },
  {
    id: 'act-034',
    actorMemberId: 'm-06',
    category: 'finance',
    action: 'logged a transaction',
    summary: 'Logged income — August dues collection',
    entityType: 'transaction',
    points: 0,
    createdAt: '2026-08-05T09:20:00.000Z',
  },
];
