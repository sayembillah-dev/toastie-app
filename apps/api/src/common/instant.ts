/**
 * Every date-time this API accepts is an **instant** — an ISO-8601 timestamp
 * that carries its own UTC offset (`…Z` or `…+06:00`).
 *
 * The guard exists because the alternative fails silently. A naive
 * `2026-08-14T10:30:00` is perfectly valid ISO-8601, so `@IsISO8601()` waves it
 * through, and `new Date(...)` then resolves it against *this process's*
 * timezone — UTC on the VPS, never the scheduler's. That is exactly how the
 * meeting editor used to shift every saved time by the editor's UTC offset.
 * Rejecting the offset-less form turns that class of bug into a 400 at the
 * boundary instead of a wrong time in the database.
 */
export const INSTANT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export const INSTANT_MESSAGE =
  '$property must be an ISO-8601 date-time with a UTC offset (e.g. 2026-08-14T10:30:00.000Z)';
