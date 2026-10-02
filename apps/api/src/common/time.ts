/**
 * The app's one clock: Bangladesh time (Asia/Dhaka, UTC+6), whatever timezone
 * this process runs in.
 *
 * Instants (`Date`, ISO strings with an offset) carry no timezone and need no
 * conversion. These helpers are only for reading an instant as a calendar date
 * — "today", or the day a timestamp falls on. `toISOString().slice(0, 10)`
 * gives the *UTC* date instead, which is yesterday for everything between
 * midnight and 06:00 in Bangladesh.
 *
 * Bangladesh has no daylight saving, so a fixed six-hour shift is exact.
 */

export const APP_TIME_ZONE = 'Asia/Dhaka';
const OFFSET_MS = 6 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of an instant in Bangladesh. */
export function dhakaDateKey(value: Date): string {
  return new Date(value.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's "YYYY-MM-DD" in Bangladesh. */
export function dhakaToday(now: Date = new Date()): string {
  return dhakaDateKey(now);
}
