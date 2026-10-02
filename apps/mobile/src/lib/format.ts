/** Date and name formatting used across screens. */

/**
 * Every date and time reads as Bangladesh time (UTC+6), whatever the phone's
 * own timezone is. Bangladesh has no daylight saving, so shifting the instant
 * by six hours and formatting it as UTC is exact — and leans only on the `UTC`
 * zone, which every JS engine's `Intl` supports, rather than `Asia/Dhaka`.
 */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function toDhakaWallClock(date: Date): Date {
  return new Date(date.getTime() + DHAKA_OFFSET_MS);
}

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const DATE_ONLY = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatMeetingDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  // 12-hour clock with an uppercase "AM"/"PM" whatever the phone's locale.
  return DATE_TIME.formatToParts(toDhakaWallClock(date))
    .map((part) => (part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value))
    .join('');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_ONLY.format(toDhakaWallClock(date));
}

export function fullName(first: string, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ');
}

/**
 * Money is stored as an integer in the smallest currency unit
 * (docs/ERD.md section 4.10), so formatting divides rather than trusting a float.
 */
export function formatMinor(amountMinor: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
    amountMinor / 100,
  );
}
