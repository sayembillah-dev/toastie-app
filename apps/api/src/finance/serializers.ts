import type {
  BudgetLine as BudgetLineRow,
  DuesRecord as DuesRecordRow,
  Transaction as TransactionRow,
} from '@prisma/client';

/** Same lists the web module carries — Prisma stores these as plain strings
 * (values are dash-separated) so validation happens at the DTO layer. */
export const INCOME_CATEGORIES = [
  'dues',
  'new-member-fee',
  'guest-fee',
  'fundraising',
  'contest-fee',
  'donation',
  'other-income',
] as const;

export const EXPENSE_CATEGORIES = [
  'ti-dues',
  'district-fees',
  'venue',
  'refreshments',
  'awards',
  'printing',
  'contest',
  'education-materials',
  'bank-charges',
  'other-expense',
] as const;

export const TRANSACTION_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'bank-transfer',
  'bkash',
  'nagad',
  'card',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  dues: 'Member dues',
  'new-member-fee': 'New member fee',
  'guest-fee': 'Guest fee',
  fundraising: 'Fundraising',
  'contest-fee': 'Contest fee',
  donation: 'Donation',
  'other-income': 'Other income',
  'ti-dues': 'TI & District dues',
  'district-fees': 'District fees',
  venue: 'Venue',
  refreshments: 'Refreshments',
  awards: 'Awards & ribbons',
  printing: 'Printing',
  contest: 'Contest expenses',
  'education-materials': 'Education materials',
  'bank-charges': 'Bank charges',
  'other-expense': 'Other expense',
};

export function isIncomeCategory(category: TransactionCategory): boolean {
  return (INCOME_CATEGORIES as readonly string[]).includes(category);
}

/** Wire shape matches the web `lib/finance/transactions.ts` `Transaction`
 * interface. */
export interface TransactionWire {
  id: string;
  clubId: string;
  date: string;
  direction: 'in' | 'out';
  category: TransactionCategory;
  amountMinor: number;
  description: string;
  method: PaymentMethod;
  counterparty?: string;
  reference?: string;
  duesRecordId?: string;
  createdAt: string;
  updatedAt?: string;
}

export function toTransactionWire(row: TransactionRow): TransactionWire {
  const wire: TransactionWire = {
    id: row.id,
    clubId: row.clubId,
    date: row.date,
    direction: row.direction as 'in' | 'out',
    category: row.category as TransactionCategory,
    amountMinor: row.amountMinor,
    description: row.description,
    method: row.method as PaymentMethod,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.counterparty) wire.counterparty = row.counterparty;
  if (row.reference) wire.reference = row.reference;
  if (row.duesRecordId) wire.duesRecordId = row.duesRecordId;
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

/** Wire shape matches the web `lib/finance/dues.ts` `DuesRecord` interface.
 * `memberId` on the wire, `membershipId` in the DB — the frontend has
 * always called them "members". */
export interface DuesRecordWire {
  id: string;
  clubId: string;
  periodId: string;
  memberId: string;
  amountDueMinor: number;
  amountPaidMinor: number;
  waived: boolean;
  paidOn?: string;
  method?: PaymentMethod;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export function toDuesRecordWire(row: DuesRecordRow): DuesRecordWire {
  const wire: DuesRecordWire = {
    id: row.id,
    clubId: row.clubId,
    periodId: row.periodId,
    memberId: row.membershipId,
    amountDueMinor: row.amountDueMinor,
    amountPaidMinor: row.amountPaidMinor,
    waived: row.waived,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.paidOn) wire.paidOn = row.paidOn;
  if (row.method) wire.method = row.method as PaymentMethod;
  if (row.note) wire.note = row.note;
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

/** Wire shape matches the web `lib/finance/budget.ts` `BudgetLine` interface. */
export interface BudgetLineWire {
  id: string;
  clubId: string;
  fiscalYear: string;
  kind: 'income' | 'expense';
  category: TransactionCategory;
  plannedMinor: number;
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

export function toBudgetLineWire(row: BudgetLineRow): BudgetLineWire {
  const wire: BudgetLineWire = {
    id: row.id,
    clubId: row.clubId,
    fiscalYear: row.fiscalYear,
    kind: row.kind as 'income' | 'expense',
    category: row.category as TransactionCategory,
    plannedMinor: row.plannedMinor,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.note) wire.note = row.note;
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

/** Fixed calendar constants — Toastmasters renewals fall on 1 October and
 * 1 April every year. Mirrors `DUES_PERIODS` in the web module. */
export const DUES_PERIODS = [
  {
    id: '2025-oct',
    label: 'Oct 2025 – Mar 2026',
    fiscalYear: '2025-26',
    standardAmountMinor: 1_200_00,
  },
  {
    id: '2026-apr',
    label: 'Apr 2026 – Sep 2026',
    fiscalYear: '2025-26',
    standardAmountMinor: 1_200_00,
  },
  {
    id: '2026-oct',
    label: 'Oct 2026 – Mar 2027',
    fiscalYear: '2026-27',
    standardAmountMinor: 1_300_00,
  },
  {
    id: '2027-apr',
    label: 'Apr 2027 – Sep 2027',
    fiscalYear: '2026-27',
    standardAmountMinor: 1_300_00,
  },
] as const;

export function getDuesPeriod(periodId: string) {
  return DUES_PERIODS.find((p) => p.id === periodId);
}
