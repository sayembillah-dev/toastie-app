/**
 * Display names for `MeetingRoleAssignment.roleKey`.
 *
 * The API stores a free-form key rather than an enum (docs/ERD.md section 4.5), so
 * this map cannot be exhaustive and must not pretend to be — an unknown key is
 * humanized rather than dropped. A club that invents its own role still sees it
 * on the agenda instead of a blank row.
 */

const LABELS: Record<string, string> = {
  toastmaster: 'Toastmaster',
  generalEvaluator: 'General Evaluator',
  tableTopicsMaster: 'Table Topics Master',
  timer: 'Timer',
  ahCounter: 'Ah-Counter',
  grammarian: 'Grammarian',
  sergeantAtArms: 'Sergeant at Arms',
  wordOfTheDay: 'Word of the Day',
  jokeMaster: 'Joke Master',
  photographer: 'Photographer',
  videographer: 'Videographer',
};

/** `ahCounter` -> `Ah-Counter`; `some_new_role` -> `Some New Role`. */
export function meetingRoleLabel(roleKey: string): string {
  const known = LABELS[roleKey];
  if (known) return known;

  return roleKey
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The order an agenda reads in, for keys we recognize. Unknown keys sort after
 * known ones, alphabetically, so the list is at least stable between renders.
 */
const ORDER = Object.keys(LABELS);

export function compareRoleKeys(a: string, b: string): number {
  const ia = ORDER.indexOf(a);
  const ib = ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}
