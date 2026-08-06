import type { Transaction, TransactionCategory } from '@/lib/finance/transactions';

/** The treasurer's annual plan — how much each category is expected to bring
 * in or cost across a club fiscal year (1 Jul – 30 Jun). Actuals are never
 * stored here; they're computed on the fly from the ledger so they can never
 * drift out of sync with a transaction that was later edited or deleted. */

export const BUDGET_LINE_NOTE_MAX = 200;

export const FISCAL_YEARS = ['2025-26', '2026-27', '2027-28'] as const;

export type FiscalYear = (typeof FISCAL_YEARS)[number];

/** The fiscal year containing "today" in the seed data (5 Aug 2026). */
export const CURRENT_FISCAL_YEAR: FiscalYear = '2026-27';

export function getFiscalYearBounds(fiscalYear: string): { startsOn: string; endsOn: string } {
  const startYear = Number(fiscalYear.slice(0, 4));
  return { startsOn: `${startYear}-07-01`, endsOn: `${startYear + 1}-06-30` };
}

/** The Jul–Jun fiscal year a given yyyy-mm-dd date falls in, e.g. any date
 * from 2026-07-01 to 2027-06-30 returns `'2026-27'`. */
export function getFiscalYearForDate(dateIso: string): string {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7));
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export interface BudgetLine {
  id: string;
  /** Tenant boundary — the club this budget line belongs to. */
  clubId: string;
  fiscalYear: string;
  kind: 'income' | 'expense';
  category: TransactionCategory;
  plannedMinor: number;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateBudgetLineInput {
  fiscalYear: string;
  kind: 'income' | 'expense';
  category: TransactionCategory;
  plannedMinor: number;
  note?: string;
}

export interface UpdateBudgetLineInput {
  plannedMinor?: number;
  /** `null` explicitly clears the note; `undefined` leaves it alone. */
  note?: string | null;
}

/** Sums actual transaction totals per category for the given fiscal year —
 * the "actual" half of every budget row. */
export function computeActuals(
  txs: readonly Transaction[],
  fiscalYear: string,
): Map<TransactionCategory, number> {
  const actuals = new Map<TransactionCategory, number>();
  for (const tx of txs) {
    if (getFiscalYearForDate(tx.date) !== fiscalYear) continue;
    actuals.set(tx.category, (actuals.get(tx.category) ?? 0) + tx.amountMinor);
  }
  return actuals;
}

export const SEED_BUDGET_LINES: Omit<BudgetLine, 'clubId'>[] = [
  {
    id: 'bud-2026-27-dues',
    fiscalYear: '2026-27',
    kind: 'income',
    category: 'dues',
    plannedMinor: 50_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-new-member-fee',
    fiscalYear: '2026-27',
    kind: 'income',
    category: 'new-member-fee',
    plannedMinor: 3_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-guest-fee',
    fiscalYear: '2026-27',
    kind: 'income',
    category: 'guest-fee',
    plannedMinor: 1_500_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-fundraising',
    fiscalYear: '2026-27',
    kind: 'income',
    category: 'fundraising',
    plannedMinor: 5_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-donation',
    fiscalYear: '2026-27',
    kind: 'income',
    category: 'donation',
    plannedMinor: 2_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-ti-dues',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'ti-dues',
    plannedMinor: 4_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-district-fees',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'district-fees',
    plannedMinor: 2_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-venue',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'venue',
    plannedMinor: 3_600_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-refreshments',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'refreshments',
    plannedMinor: 3_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-awards',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'awards',
    plannedMinor: 1_500_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-printing',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'printing',
    plannedMinor: 1_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-contest',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'contest',
    plannedMinor: 2_000_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-education-materials',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'education-materials',
    plannedMinor: 2_500_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bud-2026-27-bank-charges',
    fiscalYear: '2026-27',
    kind: 'expense',
    category: 'bank-charges',
    plannedMinor: 300_00,
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];
