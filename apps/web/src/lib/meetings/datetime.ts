import dayjs, { type Dayjs } from '@/lib/dayjs';

import { DEFAULT_START_TIME } from './meetings';

/**
 * The single crossing point between "what the pickers show" and "what the API
 * stores".
 *
 * Every meeting date/time in this app is edited as a *local* calendar date plus
 * a local "HH:mm" wall clock, and stored as an **instant** — a full ISO-8601
 * string with a UTC offset. The two are not interchangeable, and conflating
 * them is how the app previously lost six hours on every save: the client sent
 * `2026-08-14T10:30:00` with no offset, and `new Date(...)` on the API resolved
 * it in the *API process's* timezone (UTC on the VPS) rather than the editor's,
 * so a 10:30 meeting came back as 16:30 to a browser in UTC+6.
 *
 * So: naive strings never leave this file. `toInstant` is the only way to build
 * a `dateTime` for the API, and `splitLocalDateTime` is the only way to get
 * picker values back out — always in the viewer's own timezone, which is what
 * every meeting time in the UI is meant to read as.
 */

/** Local calendar date + local "HH:mm" → the offset-aware instant the API
 * stores. `time` falls back to the club's usual slot when blank or
 * unparseable, matching what the pickers offer as a default. */
export function toInstant(date: Dayjs | string, time: string): string {
  const day = typeof date === 'string' ? dayjs(date, 'YYYY-MM-DD') : date;
  const wall = dayjs(time || DEFAULT_START_TIME, 'HH:mm');
  const at = wall.isValid() ? wall : dayjs(DEFAULT_START_TIME, 'HH:mm');
  return day.hour(at.hour()).minute(at.minute()).second(0).millisecond(0).toISOString();
}

/** An instant → the "YYYY-MM-DD" / "HH:mm" pair the DatePicker/TimePicker pair
 * edits, read off the viewer's *local* clock. */
export function splitLocalDateTime(instant: string | null): { date: string; time: string } {
  if (!instant) return { date: '', time: DEFAULT_START_TIME };
  const local = dayjs(instant);
  if (!local.isValid()) return { date: '', time: DEFAULT_START_TIME };
  return { date: local.format('YYYY-MM-DD'), time: local.format('HH:mm') };
}

/** "YYYY-MM" of an instant in the viewer's timezone — the planner's month
 * grouping key. Slicing the ISO string instead would group by UTC month and
 * put a late-evening meeting on the 31st into the next month. */
export function localMonthKey(instant: string | null): string | null {
  if (!instant) return null;
  const local = dayjs(instant);
  return local.isValid() ? local.format('YYYY-MM') : null;
}
