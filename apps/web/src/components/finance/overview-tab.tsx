'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  HandCoins,
  Receipt,
  Wallet,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Progress, Skeleton, Tag } from 'antd';
import { useMemo, useSyncExternalStore } from 'react';

import { StatTile } from '@/components/finance/stat-tile';
import { CURRENT_FISCAL_YEAR, computeActuals, getFiscalYearForDate } from '@/lib/finance/budget';
import {
  CURRENT_DUES_PERIOD_ID,
  deriveDuesStatus,
  getDuesPeriod,
  summariseDues,
} from '@/lib/finance/dues';
import { formatMoney } from '@/lib/finance/money';
import {
  CATEGORY_LABELS,
  isIncomeCategory,
  OPENING_BALANCE_MINOR,
} from '@/lib/finance/transactions';
import {
  useListBudgetLinesQuery,
  useListDuesRecordsQuery,
  useListTransactionsQuery,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* Same client-clock trick used across the app (see
 * `meeting-checklist-tab.tsx`) so the "days until due" figure stays
 * deterministic through hydration. */
let cachedClientNow: number | null = null;
function subscribeNever(): () => void {
  return () => {};
}
function readClientNow(): number {
  if (cachedClientNow === null) cachedClientNow = Date.now();
  return cachedClientNow;
}
function readServerNow(): null {
  return null;
}
function useClientNow(): number | null {
  return useSyncExternalStore(subscribeNever, readClientNow, readServerNow);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Top categories by actual amount, scaled to the largest bar in the list —
 * a plain CSS bar chart since no charting library is installed. */
function CategoryBars({
  entries,
  toneClass,
}: {
  entries: { category: string; amountMinor: number }[];
  toneClass: string;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-ink-muted">Nothing recorded yet this fiscal year.</p>;
  }
  const max = Math.max(...entries.map((entry) => entry.amountMinor));
  return (
    <ul className="flex flex-col gap-2.5">
      {entries.map((entry) => (
        <li key={entry.category}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-soft">{entry.category}</span>
            <span className="font-medium text-ink">{formatMoney(entry.amountMinor)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill">
            <div
              className={`h-full rounded-full ${toneClass}`}
              style={{ width: max > 0 ? `${Math.max(4, (entry.amountMinor / max) * 100)}%` : '0%' }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The treasurer's landing tab — a read-only roll-up of the other three tabs.
 * Nothing here has its own endpoint; every figure is derived from the same
 * queries the Dues, Transactions and Budget tabs already fetch, so the four
 * tabs can never show different numbers for the same underlying data. */
export function OverviewTab() {
  const now = useClientNow();
  const txsQuery = useListTransactionsQuery();
  const duesQuery = useListDuesRecordsQuery(CURRENT_DUES_PERIOD_ID);
  const budgetQuery = useListBudgetLinesQuery(CURRENT_FISCAL_YEAR);

  const isLoading =
    txsQuery.isLoading || duesQuery.isLoading || budgetQuery.isLoading || now === null;
  const isError = txsQuery.isError || duesQuery.isError || budgetQuery.isError;
  const error = txsQuery.error ?? duesQuery.error ?? budgetQuery.error;

  const derived = useMemo(() => {
    const txs = txsQuery.data ?? [];
    const duesRecords = duesQuery.data ?? [];
    const budgetLines = budgetQuery.data ?? [];

    const balanceMinor =
      OPENING_BALANCE_MINOR +
      txs.reduce(
        (total, tx) => total + (tx.direction === 'in' ? tx.amountMinor : -tx.amountMinor),
        0,
      );

    const fyTxs = txs.filter((tx) => getFiscalYearForDate(tx.date) === CURRENT_FISCAL_YEAR);
    const incomeMinor = fyTxs
      .filter((tx) => tx.direction === 'in')
      .reduce((total, tx) => total + tx.amountMinor, 0);
    const expenseMinor = fyTxs
      .filter((tx) => tx.direction === 'out')
      .reduce((total, tx) => total + tx.amountMinor, 0);

    const actuals = computeActuals(txs, CURRENT_FISCAL_YEAR);
    const topIncome = [...actuals.entries()]
      .filter(([category]) => isIncomeCategory(category))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amountMinor]) => ({ category: CATEGORY_LABELS[category], amountMinor }));
    const topExpense = [...actuals.entries()]
      .filter(([category]) => !isIncomeCategory(category))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amountMinor]) => ({ category: CATEGORY_LABELS[category], amountMinor }));

    const duesSummary = summariseDues(duesRecords);
    const duesPeriod = getDuesPeriod(CURRENT_DUES_PERIOD_ID);
    const overdueMembers = duesRecords.filter((record) => {
      const status = deriveDuesStatus(record);
      return status === 'unpaid' || status === 'partial';
    }).length;

    const overBudgetLines = budgetLines.filter((line) => {
      const actual = actuals.get(line.category) ?? 0;
      return line.plannedMinor > 0 && actual > line.plannedMinor;
    });

    const recent = [...txs]
      .sort((a, b) =>
        a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1,
      )
      .slice(0, 5);

    return {
      balanceMinor,
      incomeMinor,
      expenseMinor,
      topIncome,
      topExpense,
      duesSummary,
      duesPeriod,
      overdueMembers,
      overBudgetLines,
      recent,
    };
  }, [txsQuery.data, duesQuery.data, budgetQuery.data]);

  if (isError) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load the finance overview</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
            <div key={index} className="rounded-xl border border-line bg-canvas p-4">
              <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    balanceMinor,
    incomeMinor,
    expenseMinor,
    topIncome,
    topExpense,
    duesSummary,
    duesPeriod,
    overdueMembers,
    overBudgetLines,
    recent,
  } = derived;

  const daysUntilDue = duesPeriod
    ? Math.round((new Date(duesPeriod.dueOn).getTime() - (now ?? 0)) / DAY_MS)
    : null;
  const duesPercent =
    duesSummary.total === 0 ? 0 : Math.round((duesSummary.paid / duesSummary.total) * 100);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {overdueMembers > 0 || overBudgetLines.length > 0 ? (
        <div className="flex flex-col gap-2">
          {overdueMembers > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <WarningCircle size={14} weight="bold" className="shrink-0" />
              <span>
                {overdueMembers} {overdueMembers === 1 ? 'member has' : 'members have'} not paid
                dues for {duesPeriod?.label ?? 'the current period'}.
              </span>
            </div>
          ) : null}
          {overBudgetLines.length > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <WarningCircle size={14} weight="bold" className="shrink-0" />
              <span>
                {overBudgetLines.length} budget{' '}
                {overBudgetLines.length === 1 ? 'line is' : 'lines are'} over plan for{' '}
                {CURRENT_FISCAL_YEAR}:{' '}
                {overBudgetLines.map((line) => CATEGORY_LABELS[line.category]).join(', ')}.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Wallet size={16} />}
          label="Current balance"
          value={formatMoney(balanceMinor)}
          hint="Across the full ledger"
        />
        <StatTile
          icon={<ArrowUpRight size={16} />}
          label={`Income · FY ${CURRENT_FISCAL_YEAR}`}
          value={formatMoney(incomeMinor)}
          tone="positive"
        />
        <StatTile
          icon={<ArrowDownRight size={16} />}
          label={`Expenses · FY ${CURRENT_FISCAL_YEAR}`}
          value={formatMoney(expenseMinor)}
          tone="negative"
        />
        <StatTile
          icon={<HandCoins size={16} />}
          label="Outstanding dues"
          value={formatMoney(duesSummary.outstandingMinor)}
          tone={duesSummary.outstandingMinor > 0 ? 'warning' : 'default'}
          hint={duesPeriod?.label}
        />
      </div>

      <div className="rounded-xl border border-line bg-canvas p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Dues collection</h2>
          <span className="text-xs text-ink-muted">
            {daysUntilDue !== null && daysUntilDue >= 0
              ? `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`
              : daysUntilDue !== null
                ? `Due since ${new Date(duesPeriod?.dueOn ?? '').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}`
                : null}
          </span>
        </div>
        <Progress percent={duesPercent} strokeColor="#059669" />
        <p className="mt-1 text-xs text-ink-soft">
          {duesSummary.paid} of {duesSummary.total} members paid for{' '}
          {duesPeriod?.label ?? 'this period'}
          {duesSummary.partial > 0 ? ` · ${duesSummary.partial} partial` : ''}
          {duesSummary.waived > 0 ? ` · ${duesSummary.waived} waived` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-canvas p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Top income · FY {CURRENT_FISCAL_YEAR}
          </h2>
          <CategoryBars entries={topIncome} toneClass="bg-emerald-500" />
        </div>
        <div className="rounded-xl border border-line bg-canvas p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Top expenses · FY {CURRENT_FISCAL_YEAR}
          </h2>
          <CategoryBars entries={topExpense} toneClass="bg-rose-400" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-canvas p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="text-xs text-ink-muted">No transactions recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                      tx.direction === 'in'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-fill text-ink-soft'
                    }`}
                  >
                    {tx.direction === 'in' ? <Coins size={14} /> : <Receipt size={14} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-ink" title={tx.description}>
                      {tx.description}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {new Date(tx.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}{' '}
                      · {CATEGORY_LABELS[tx.category]}
                    </p>
                  </div>
                </div>
                <Tag color={tx.direction === 'in' ? 'success' : 'default'} className="shrink-0">
                  {tx.direction === 'in' ? '+' : '−'}
                  {formatMoney(tx.amountMinor)}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
