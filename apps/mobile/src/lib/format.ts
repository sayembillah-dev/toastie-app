/** Date and name formatting used across screens. */

const DATE_TIME = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const DATE_ONLY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatMeetingDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_ONLY.format(date);
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
