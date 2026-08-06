/** The club's ledger — every taka in or out. This is the single source of
 * truth the Overview and Budget tabs derive their numbers from; nothing else
 * stores a running total. */

export const TRANSACTION_DESCRIPTION_MAX = 200;
export const TRANSACTION_COUNTERPARTY_MAX = 120;
export const TRANSACTION_REFERENCE_MAX = 60;

export type TxDirection = 'in' | 'out';

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

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export function isTransactionCategory(value: unknown): value is TransactionCategory {
  return (TRANSACTION_CATEGORIES as readonly string[]).includes(value as string);
}

export function isIncomeCategory(category: TransactionCategory): category is IncomeCategory {
  return (INCOME_CATEGORIES as readonly string[]).includes(category);
}

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

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value as string);
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  'bank-transfer': 'Bank transfer',
  bkash: 'bKash',
  nagad: 'Nagad',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export interface Transaction {
  id: string;
  /** Tenant boundary — the club this transaction belongs to. */
  clubId: string;
  /** ISO date (yyyy-mm-dd) the money actually moved. */
  date: string;
  direction: TxDirection;
  category: TransactionCategory;
  amountMinor: number;
  description: string;
  method: PaymentMethod;
  counterparty?: string;
  reference?: string;
  /** Set only on the income row auto-created when a dues payment is recorded.
   * Present so the row can be marked "From dues" and blocked from direct
   * deletion — it is retired by resetting the dues record instead. */
  duesRecordId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTransactionInput {
  date: string;
  direction: TxDirection;
  category: TransactionCategory;
  amountMinor: number;
  description: string;
  method: PaymentMethod;
  counterparty?: string;
  reference?: string;
}

export interface UpdateTransactionInput {
  date?: string;
  direction?: TxDirection;
  category?: TransactionCategory;
  amountMinor?: number;
  description?: string;
  method?: PaymentMethod;
  counterparty?: string;
  reference?: string;
}

/** Newest first, ties broken by insertion order — same convention as the
 * inventory list. */
export function sortTransactionsNewestFirst(txs: readonly Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function matchesTransactionQuery(tx: Transaction, needle: string): boolean {
  const haystack =
    `${tx.description} ${tx.counterparty ?? ''} ${tx.reference ?? ''} ${CATEGORY_LABELS[tx.category]}`.toLowerCase();
  return haystack.includes(needle);
}

/** Oldest-first running balance, for the ledger's balance column. Pass the
 * list in whatever order; this re-sorts ascending internally so the running
 * total is chronological. */
export function computeRunningBalances(
  txs: readonly Transaction[],
  openingMinor: number,
): Map<string, number> {
  const oldestFirst = [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : 1;
  });
  const balances = new Map<string, number>();
  let running = openingMinor;
  for (const tx of oldestFirst) {
    running += tx.direction === 'in' ? tx.amountMinor : -tx.amountMinor;
    balances.set(tx.id, running);
  }
  return balances;
}

export function sumTransactions(txs: readonly Transaction[], direction?: TxDirection): number {
  return txs
    .filter((tx) => direction === undefined || tx.direction === direction)
    .reduce((total, tx) => total + tx.amountMinor, 0);
}

/** The club's carried-forward balance before the earliest seeded transaction —
 * stands in for whatever real opening balance a treasurer would enter once
 * when first setting up the ledger. */
export const OPENING_BALANCE_MINOR = 4_250_000; // ৳42,500.00

export const SEED_TRANSACTIONS: Omit<Transaction, 'clubId'>[] = [
  {
    id: 'tx-01',
    date: '2026-02-03',
    direction: 'out',
    category: 'ti-dues',
    amountMinor: 950_00,
    description: 'Semi-annual dues remitted to Toastmasters International',
    method: 'bank-transfer',
    counterparty: 'Toastmasters International',
    createdAt: '2026-02-03T09:00:00.000Z',
  },
  {
    id: 'tx-02',
    date: '2026-02-10',
    direction: 'out',
    category: 'venue',
    amountMinor: 300_00,
    description: 'Function room booking — March meetings',
    method: 'bank-transfer',
    counterparty: 'Gulshan Community Centre',
    createdAt: '2026-02-10T09:00:00.000Z',
  },
  {
    id: 'tx-03',
    date: '2026-03-01',
    direction: 'in',
    category: 'guest-fee',
    amountMinor: 100_00,
    description: 'Guest fees — March 1 meeting',
    method: 'cash',
    createdAt: '2026-03-01T13:00:00.000Z',
  },
  {
    id: 'tx-04',
    date: '2026-03-08',
    direction: 'out',
    category: 'refreshments',
    amountMinor: 220_00,
    description: 'Tea, biscuits and water for the meeting',
    method: 'cash',
    counterparty: 'Shwapno',
    createdAt: '2026-03-08T13:00:00.000Z',
  },
  {
    id: 'tx-05',
    date: '2026-04-05',
    direction: 'in',
    category: 'new-member-fee',
    amountMinor: 500_00,
    description: 'New member fee — Riley Novak',
    method: 'bkash',
    counterparty: 'Riley Novak',
    createdAt: '2026-04-05T10:00:00.000Z',
  },
  {
    id: 'tx-06',
    date: '2026-04-12',
    direction: 'out',
    category: 'printing',
    amountMinor: 85_00,
    description: 'Agenda and evaluation slip printing',
    method: 'cash',
    createdAt: '2026-04-12T10:00:00.000Z',
  },
  {
    id: 'tx-07',
    date: '2026-05-02',
    direction: 'in',
    category: 'fundraising',
    amountMinor: 1_500_00,
    description: 'Bake sale at the club open house',
    method: 'cash',
    createdAt: '2026-05-02T15:00:00.000Z',
  },
  {
    id: 'tx-08',
    date: '2026-05-15',
    direction: 'out',
    category: 'awards',
    amountMinor: 180_00,
    description: 'Best speaker & best evaluator ribbons',
    method: 'cash',
    counterparty: 'Ananya Print & Trophy',
    createdAt: '2026-05-15T10:00:00.000Z',
  },
  {
    id: 'tx-09',
    date: '2026-06-07',
    direction: 'out',
    category: 'bank-charges',
    amountMinor: 25_00,
    description: 'Quarterly account maintenance fee',
    method: 'bank-transfer',
    counterparty: 'Bank',
    createdAt: '2026-06-07T09:00:00.000Z',
  },
  {
    id: 'tx-10',
    date: '2026-06-21',
    direction: 'in',
    category: 'donation',
    amountMinor: 1_000_00,
    description: 'Founder-member anniversary gift to the club',
    method: 'bank-transfer',
    counterparty: 'Nathan Brooks',
    createdAt: '2026-06-21T10:00:00.000Z',
  },
  {
    id: 'tx-11',
    date: '2026-07-04',
    direction: 'out',
    category: 'education-materials',
    amountMinor: 340_00,
    description: 'Pathways manuals for two new members',
    method: 'card',
    counterparty: 'Toastmasters International',
    createdAt: '2026-07-04T09:00:00.000Z',
  },
  {
    id: 'tx-12',
    date: '2026-07-19',
    direction: 'out',
    category: 'venue',
    amountMinor: 300_00,
    description: 'Function room booking — August meetings',
    method: 'bank-transfer',
    counterparty: 'Gulshan Community Centre',
    createdAt: '2026-07-19T09:00:00.000Z',
  },
  {
    id: 'tx-13',
    date: '2026-07-26',
    direction: 'in',
    category: 'guest-fee',
    amountMinor: 150_00,
    description: 'Guest fees — July 26 meeting',
    method: 'cash',
    createdAt: '2026-07-26T13:00:00.000Z',
  },
  {
    id: 'tx-14',
    date: '2026-08-02',
    direction: 'out',
    category: 'refreshments',
    amountMinor: 260_00,
    description: 'Tea, biscuits and water for the meeting',
    method: 'cash',
    counterparty: 'Shwapno',
    createdAt: '2026-08-02T13:00:00.000Z',
  },
  /* Dues income for the current renewal period (Apr 2026 – Sep 2026). Each row
   * is linked back to its `DuesRecord` via `duesRecordId` — see
   * `SEED_DUES_RECORDS` in `lib/finance/dues.ts`. Recording a dues payment
   * through the UI creates a row exactly like these. */
  {
    id: 'tx-15',
    date: '2026-04-03',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'bank-transfer',
    counterparty: 'Aisha Patel',
    duesRecordId: 'dues-2026-apr-m-01',
    createdAt: '2026-04-03T09:00:00.000Z',
  },
  {
    id: 'tx-16',
    date: '2026-04-05',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'bkash',
    counterparty: 'Marcus Chen',
    duesRecordId: 'dues-2026-apr-m-02',
    createdAt: '2026-04-05T09:00:00.000Z',
  },
  {
    id: 'tx-17',
    date: '2026-04-10',
    direction: 'in',
    category: 'dues',
    amountMinor: 600_00,
    description: 'Dues — Apr 2026 – Sep 2026 (partial)',
    method: 'cash',
    counterparty: 'Priya Sharma',
    duesRecordId: 'dues-2026-apr-m-03',
    createdAt: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'tx-18',
    date: '2026-04-02',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'bank-transfer',
    counterparty: 'Nathan Brooks',
    duesRecordId: 'dues-2026-apr-m-06',
    createdAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'tx-19',
    date: '2026-04-07',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'cash',
    counterparty: 'Liam Reeves',
    duesRecordId: 'dues-2026-apr-m-08',
    createdAt: '2026-04-07T09:00:00.000Z',
  },
  {
    id: 'tx-20',
    date: '2026-04-08',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'bkash',
    counterparty: 'Grace Okafor',
    duesRecordId: 'dues-2026-apr-m-09',
    createdAt: '2026-04-08T09:00:00.000Z',
  },
  {
    id: 'tx-21',
    date: '2026-04-20',
    direction: 'in',
    category: 'dues',
    amountMinor: 600_00,
    description: 'Dues — Apr 2026 – Sep 2026 (partial)',
    method: 'bkash',
    counterparty: 'Rafael Mendoza',
    duesRecordId: 'dues-2026-apr-m-10',
    createdAt: '2026-04-20T09:00:00.000Z',
  },
  {
    id: 'tx-22',
    date: '2026-04-12',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'nagad',
    counterparty: 'Zara Ahmed',
    duesRecordId: 'dues-2026-apr-m-13',
    createdAt: '2026-04-12T09:00:00.000Z',
  },
  {
    id: 'tx-23',
    date: '2026-04-15',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'cash',
    counterparty: 'Riley Novak',
    duesRecordId: 'dues-2026-apr-m-15',
    createdAt: '2026-04-15T09:00:00.000Z',
  },
  {
    id: 'tx-24',
    date: '2026-04-18',
    direction: 'in',
    category: 'dues',
    amountMinor: 1_200_00,
    description: 'Dues — Apr 2026 – Sep 2026',
    method: 'card',
    counterparty: 'Amelia Fischer',
    duesRecordId: 'dues-2026-apr-m-16',
    createdAt: '2026-04-18T09:00:00.000Z',
  },
];
