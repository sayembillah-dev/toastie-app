import dayjs, { type Dayjs } from '@/lib/dayjs';
import { dhakaDateKey, dhakaFormat, dhakaInstant, dhakaTimeKey } from '@/lib/time';

import { DEFAULT_START_TIME } from './meetings';

/**
 * The single crossing point between "what the pickers show" and "what the API
 * stores".
 *
 * Every meeting date/time in this app is edited as a Bangladesh calendar date
 * plus a Bangladesh "HH:mm" wall clock, and stored as an **instant** — a full
 * ISO-8601 string with a UTC offset. The two are not interchangeable, and
 * conflating them is how the app previously lost six hours on every save: the
 * client sent `2026-08-14T10:30:00` with no offset, and `new Date(...)` on the
 * API resolved it in the *API process's* timezone (UTC on the VPS), so a 10:30
 * meeting came back as 16:30.
 *
 * antd's pickers hold plain dayjs values in the *browser's* timezone, so they
 * never see an instant directly. Instants go in as a naive Bangladesh
 * wall-clock reading and come back out with `+06:00` appended — the same
 * meeting time on every device, whatever its clock is set to.
 */

/** Bangladesh calendar date + Bangladesh "HH:mm" → the offset-aware instant
 * the API stores. `time` falls back to the club's usual slot when blank or
 * unparseable, matching what the pickers offer as a default. */
export function toInstant(date: Dayjs | string, time: string): string {
  const ymd = typeof date === 'string' ? date : date.format('YYYY-MM-DD');
  const wall = dayjs(time || DEFAULT_START_TIME, 'HH:mm');
  const hm = wall.isValid() ? wall.format('HH:mm') : DEFAULT_START_TIME;
  return dhakaInstant(ymd, hm).toISOString();
}

/** An instant → the "YYYY-MM-DD" / "HH:mm" pair the DatePicker/TimePicker pair
 * edits, read off a Bangladesh wall clock. */
export function splitDhakaDateTime(instant: string | null): { date: string; time: string } {
  if (!instant || Number.isNaN(Date.parse(instant))) {
    return { date: '', time: DEFAULT_START_TIME };
  }
  return { date: dhakaDateKey(instant), time: dhakaTimeKey(instant) };
}

/** An instant → a value for a combined date-and-time picker, showing the
 * Bangladesh wall clock. Pair with `instantFromPicker` on change. */
export function pickerValueFromInstant(instant: string | null): Dayjs | null {
  if (!instant || Number.isNaN(Date.parse(instant))) return null;
  return dayjs(`${dhakaDateKey(instant)} ${dhakaTimeKey(instant)}`, 'YYYY-MM-DD HH:mm');
}

/** A combined date-and-time picker value, read as Bangladesh time → instant. */
export function instantFromPicker(value: Dayjs): string {
  return dhakaInstant(value.format('YYYY-MM-DD'), value.format('HH:mm')).toISOString();
}

/** "YYYY-MM" of an instant in Bangladesh — the planner's month grouping key.
 * Slicing the ISO string instead would group by UTC month and put a meeting
 * early on the 1st (Bangladesh) into the previous month. */
export function dhakaMonthKey(instant: string | null): string | null {
  if (!instant || Number.isNaN(Date.parse(instant))) return null;
  return dhakaDateKey(instant).slice(0, 7);
}

const MONTH_LABEL_FMT = dhakaFormat(undefined, {
  month: 'long',
  year: 'numeric',
});

/** "September 2026" for an instant, read in Bangladesh — the planner's month
 * dividers on both the desktop grid and the mobile cards. */
export function dhakaMonthLabel(instant: string): string {
  return MONTH_LABEL_FMT.format(new Date(instant));
}
