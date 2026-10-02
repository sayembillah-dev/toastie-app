/**
 * The app's one clock: Bangladesh time (Asia/Dhaka, UTC+6), whatever the
 * viewer's browser or the server is set to.
 *
 * Instants (ISO strings with `Z` or an offset, `Date.now()`) carry no timezone
 * and pass through untouched. The helpers here are for the two crossings that
 * do: an instant read as calendar fields (date, hour, "today"), and calendar
 * fields turned back into an instant. Never use `getHours()`, `setHours()`,
 * `toLocaleDateString()` without `timeZone`, or `new Date('YYYY-MM-DDT00:00')`
 * for those — they all read the device's own timezone.
 *
 * Bangladesh has had no daylight saving since 2009, so the offset is fixed and
 * shifting by six hours then reading `getUTC*` is exact on every engine.
 */

export const APP_TIME_ZONE = 'Asia/Dhaka';
export const APP_UTC_OFFSET = '+06:00';
const OFFSET_MS = 6 * 60 * 60 * 1000;

export type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export interface DhakaFormatter {
  format(value: Date | number): string;
}

/** A date/time formatter pinned to Bangladesh time. Use in place of
 * `new Intl.DateTimeFormat(...)` for anything that formats a date or time.
 *
 * Any formatter that shows the hour uses the 12-hour clock with an uppercase
 * "AM"/"PM", whatever the locale — `en-GB` alone would print "7:00 pm", and an
 * `hourCycle`/`hour12: false` option asked for by a caller is overridden. */
export function dhakaFormat(
  locale: string | undefined,
  options: Omit<Intl.DateTimeFormatOptions, 'timeZone' | 'hour12' | 'hourCycle'>,
): DhakaFormatter {
  if (!options.hour) {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: APP_TIME_ZONE });
  }
  const fmt = new Intl.DateTimeFormat(locale, {
    ...options,
    hour: 'numeric',
    hour12: true,
    timeZone: APP_TIME_ZONE,
  });
  return {
    format: (value) =>
      fmt
        .formatToParts(value)
        .map((part) => (part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value))
        .join(''),
  };
}

/** "7:00 PM" — an instant's Bangladesh time on the 12-hour clock. */
export function formatDhakaTime(value: DateInput): string {
  const { hour, minute } = dhakaParts(value);
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** antd TimePicker / DatePicker `format` for anything showing a time. Pair
 * with `use12Hours` on TimePicker. */
export const PICKER_TIME_FORMAT = 'h:mm A';

export interface DhakaParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

/** The calendar fields of an instant as read on a Bangladesh wall clock. */
export function dhakaParts(value: DateInput): DhakaParts {
  const shifted = new Date(toDate(value).getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** "YYYY-MM-DD" of an instant in Bangladesh. */
export function dhakaDateKey(value: DateInput): string {
  const p = dhakaParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:mm" of an instant in Bangladesh. */
export function dhakaTimeKey(value: DateInput): string {
  const p = dhakaParts(value);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today's "YYYY-MM-DD" in Bangladesh. */
export function dhakaToday(now: DateInput = Date.now()): string {
  return dhakaDateKey(now);
}

/** A Bangladesh calendar date (+ optional "HH:mm") → the instant it names.
 * Accepts a full ISO string too and keeps only its date part, so it is safe
 * on date-only fields however the API spelled them. */
export function dhakaInstant(ymd: string, hm = '00:00'): Date {
  return new Date(`${ymd.slice(0, 10)}T${hm}:00${APP_UTC_OFFSET}`);
}

/** Midnight in Bangladesh on the day the instant falls on. */
export function startOfDhakaDay(value: DateInput): Date {
  return dhakaInstant(dhakaDateKey(value));
}

/** Shift a Bangladesh calendar date by whole days / months, "YYYY-MM-DD" in
 * and out. Month arithmetic clamps to the last day (31 Mar − 1 month = 28/29 Feb). */
export function addDhakaDays(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addDhakaMonths(ymd: string, months: number): string {
  const [y, m, day] = ymd.slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole Bangladesh calendar days from `from` to `to` (negative if `to` is earlier). */
export function dhakaDayDiff(from: DateInput, to: DateInput): number {
  const a = Date.parse(`${dhakaDateKey(from)}T00:00:00Z`);
  const b = Date.parse(`${dhakaDateKey(to)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
