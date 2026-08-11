import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

/**
 * The one dayjs anything in this app should import.
 *
 * Plain `dayjs(value, format)` silently ignores the format argument unless
 * `customParseFormat` is registered — `dayjs('19:00', 'HH:mm')` then falls back
 * to `new Date('19:00')` and comes out Invalid. Every DatePicker/TimePicker
 * pair here round-trips through "YYYY-MM-DD" / "HH:mm" strings, so an
 * unregistered plugin left the time picker blank and made saves send
 * `2026-08-11TInvalid Date:00` to the API.
 *
 * Registering it here rather than in a provider keeps it a hard dependency of
 * the import instead of something that has to run first.
 */
dayjs.extend(customParseFormat);

export default dayjs;
export type { Dayjs } from 'dayjs';
