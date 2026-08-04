/** Money helpers for the Finance page. Amounts are always stored and passed
 * around as integer minor units (poisha — 1 taka = 100 poisha) so totals never
 * accumulate floating-point drift. Nothing outside this file should do
 * arithmetic on a formatted money string. */

export const CURRENCY = 'BDT';
const LOCALE = 'en-BD';

const MONEY_FMT = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  currencyDisplay: 'narrowSymbol',
});

/** 125000 -> "৳1,250.00" */
export function formatMoney(minor: number): string {
  return MONEY_FMT.format(minor / 100);
}

/** Same as `formatMoney`, but prefixes a +/− based on ledger direction so a
 * row reads correctly even for someone skimming without colour. */
export function formatMoneySigned(minor: number, direction: 'in' | 'out'): string {
  const sign = direction === 'in' ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(minor))}`;
}

/** Form input (taka, e.g. 1250.5) -> storage (poisha, e.g. 125050). Rounds to
 * the nearest poisha to absorb float noise from the input control. */
export function toMinor(taka: number): number {
  return Math.round(taka * 100);
}

/** Storage (poisha) -> form input (taka), for pre-filling an edit form. */
export function fromMinor(minor: number): number {
  return minor / 100;
}

export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
