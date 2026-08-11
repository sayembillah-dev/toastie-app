/// Local Bangladeshi mobile format only: exactly 11 digits, e.g. `01568286512`.
/// Deliberately a plain strip, not smart E.164 conversion — `+8801717457286`
/// normalizes to 10 digits and is rejected rather than silently gaining a `0`.
export const PHONE_REGEX = /^\d{11}$/;

export function normalizePhone(raw: string): string {
  return raw
    .trim()
    .replace(/[\s-]/g, '')
    .replace(/^\+?880/, '')
    .replace(/^\+?88/, '');
}
