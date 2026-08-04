/** A single item on a meeting's pre-meeting checklist. Kept meeting-scoped so
 * the Meeting tab and the Inventory tab read the same rows for the current
 * meeting — ticking off from either surface updates the other. */

export const CHECKLIST_ITEM_TEXT_MAX = 120;

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CreateChecklistItemInput {
  text: string;
}

export interface UpdateChecklistItemInput {
  text?: string;
  done?: boolean;
}

/** Seeded onto every fresh meeting so the SAA never lands on a blank list. The
 * user can edit or delete them like any other row. */
export const DEFAULT_CHECKLIST_TEXTS: readonly string[] = [
  'Arrange chairs and tables',
  'Display the club banner',
  'Print Agenda and others documents',
  'Gather Time Ballots',
  'Food for the guests',
];
