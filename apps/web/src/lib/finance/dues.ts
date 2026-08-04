import type { PaymentMethod } from '@/lib/finance/transactions';

/** Semi-annual membership dues. Toastmasters renewals fall on 1 October
 * (covering Oct–Mar) and 1 April (covering Apr–Sep) every year — a fixed
 * calendar, not user data, so the periods are constants rather than a
 * localStorage table. Only the per-member payment records are stored. */

export interface DuesPeriod {
  id: string;
  label: string;
  /** The club fiscal year (Jul–Jun) this period's due date falls in. */
  fiscalYear: string;
  startsOn: string;
  endsOn: string;
  dueOn: string;
  standardAmountMinor: number;
}

export const DUES_PERIODS: DuesPeriod[] = [
  {
    id: '2025-oct',
    label: 'Oct 2025 – Mar 2026',
    fiscalYear: '2025-26',
    startsOn: '2025-10-01',
    endsOn: '2026-03-31',
    dueOn: '2025-10-01',
    standardAmountMinor: 1_200_00,
  },
  {
    id: '2026-apr',
    label: 'Apr 2026 – Sep 2026',
    fiscalYear: '2025-26',
    startsOn: '2026-04-01',
    endsOn: '2026-09-30',
    dueOn: '2026-04-01',
    standardAmountMinor: 1_200_00,
  },
  {
    id: '2026-oct',
    label: 'Oct 2026 – Mar 2027',
    fiscalYear: '2026-27',
    startsOn: '2026-10-01',
    endsOn: '2027-03-31',
    dueOn: '2026-10-01',
    standardAmountMinor: 1_300_00,
  },
  {
    id: '2027-apr',
    label: 'Apr 2027 – Sep 2027',
    fiscalYear: '2026-27',
    startsOn: '2027-04-01',
    endsOn: '2027-09-30',
    dueOn: '2027-04-01',
    standardAmountMinor: 1_300_00,
  },
];

/** The period covering "today" in the seed data (5 Aug 2026). */
export const CURRENT_DUES_PERIOD_ID = '2026-apr';

export function getDuesPeriod(periodId: string): DuesPeriod | undefined {
  return DUES_PERIODS.find((period) => period.id === periodId);
}

export type DuesStatus = 'paid' | 'partial' | 'unpaid' | 'waived';

/** One row per member per period. Status is always derived from the amounts
 * rather than stored, so it can never drift out of sync with a payment. */
export interface DuesRecord {
  id: string;
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

/** Body for `PATCH /dues-records/:recordId`. Setting `amountPaidMinor` above
 * zero is what triggers the linked ledger entry server-side; setting it back
 * to `0` (a "reset") removes that entry again. `waived: true` excludes the
 * record from outstanding totals without recording a payment. */
export interface UpdateDuesRecordInput {
  amountPaidMinor?: number;
  waived?: boolean;
  paidOn?: string | null;
  method?: PaymentMethod | null;
  note?: string | null;
}

export function deriveDuesStatus(record: DuesRecord): DuesStatus {
  if (record.waived) return 'waived';
  if (record.amountPaidMinor <= 0) return 'unpaid';
  if (record.amountPaidMinor >= record.amountDueMinor) return 'paid';
  return 'partial';
}

export const DUES_STATUS_LABELS: Record<DuesStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  waived: 'Waived',
};

export interface DuesSummary {
  total: number;
  paid: number;
  partial: number;
  unpaid: number;
  waived: number;
  collectedMinor: number;
  outstandingMinor: number;
}

export function summariseDues(records: readonly DuesRecord[]): DuesSummary {
  const summary: DuesSummary = {
    total: records.length,
    paid: 0,
    partial: 0,
    unpaid: 0,
    waived: 0,
    collectedMinor: 0,
    outstandingMinor: 0,
  };
  for (const record of records) {
    const status = deriveDuesStatus(record);
    summary[status] += 1;
    summary.collectedMinor += record.amountPaidMinor;
    if (status !== 'waived') {
      summary.outstandingMinor += Math.max(0, record.amountDueMinor - record.amountPaidMinor);
    }
  }
  return summary;
}

/** Seeded records for the current renewal period only — every other period
 * materialises its rows on first request from the live member roster (see
 * `listDuesRecords` in `local-db/handlers.ts`), so this list doesn't need to
 * anticipate every member for every period. */
export const SEED_DUES_RECORDS: DuesRecord[] = [
  {
    id: 'dues-2026-apr-m-01',
    periodId: '2026-apr',
    memberId: 'm-01',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-03',
    method: 'bank-transfer',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-03T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-02',
    periodId: '2026-apr',
    memberId: 'm-02',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-05',
    method: 'bkash',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-05T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-03',
    periodId: '2026-apr',
    memberId: 'm-03',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 600_00,
    waived: false,
    paidOn: '2026-04-10',
    method: 'cash',
    note: 'Rest due after payday',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-10T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-04',
    periodId: '2026-apr',
    memberId: 'm-04',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-05',
    periodId: '2026-apr',
    memberId: 'm-05',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: true,
    note: 'Waived by committee vote — financial hardship',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-06',
    periodId: '2026-apr',
    memberId: 'm-06',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-02',
    method: 'bank-transfer',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-07',
    periodId: '2026-apr',
    memberId: 'm-07',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-08',
    periodId: '2026-apr',
    memberId: 'm-08',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-07',
    method: 'cash',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-07T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-09',
    periodId: '2026-apr',
    memberId: 'm-09',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-08',
    method: 'bkash',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-08T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-10',
    periodId: '2026-apr',
    memberId: 'm-10',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 600_00,
    waived: false,
    paidOn: '2026-04-20',
    method: 'bkash',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-20T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-11',
    periodId: '2026-apr',
    memberId: 'm-11',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-12',
    periodId: '2026-apr',
    memberId: 'm-12',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-13',
    periodId: '2026-apr',
    memberId: 'm-13',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-12',
    method: 'nagad',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-12T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-14',
    periodId: '2026-apr',
    memberId: 'm-14',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-15',
    periodId: '2026-apr',
    memberId: 'm-15',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-15',
    method: 'cash',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-16',
    periodId: '2026-apr',
    memberId: 'm-16',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 1_200_00,
    waived: false,
    paidOn: '2026-04-18',
    method: 'card',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-18T09:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-17',
    periodId: '2026-apr',
    memberId: 'm-17',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-18',
    periodId: '2026-apr',
    memberId: 'm-18',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-19',
    periodId: '2026-apr',
    memberId: 'm-19',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
  {
    id: 'dues-2026-apr-m-20',
    periodId: '2026-apr',
    memberId: 'm-20',
    amountDueMinor: 1_200_00,
    amountPaidMinor: 0,
    waived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
  },
];
