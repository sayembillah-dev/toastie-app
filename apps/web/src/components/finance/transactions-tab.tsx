'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  MagnifyingGlass,
  Plus,
  Receipt,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Segmented, Select, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { TransactionModal } from '@/components/finance/transaction-modal';
import { formatMoney, formatMoneySigned } from '@/lib/finance/money';
import type { Transaction, TxDirection } from '@/lib/finance/transactions';
import {
  CATEGORY_LABELS,
  computeRunningBalances,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  matchesTransactionQuery,
  OPENING_BALANCE_MINOR,
  sortTransactionsNewestFirst,
  sumTransactions,
} from '@/lib/finance/transactions';
import { useCan } from '@/lib/permissions/use-can';
import { useListTransactionsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

type DirectionFilter = 'all' | TxDirection;

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const CATEGORY_OPTIONS = [
  { label: 'All categories', value: 'all' },
  {
    label: 'Income',
    options: INCOME_CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: c })),
  },
  {
    label: 'Expenses',
    options: EXPENSE_CATEGORIES.map((c) => ({ label: CATEGORY_LABELS[c], value: c })),
  },
];

/** The full ledger — every taka the club has taken in or paid out, newest
 * first, with a running balance column. */
export function TransactionsTab() {
  const { data: transactions, isLoading, isError, error, refetch } = useListTransactionsQuery();
  const { can } = useCan();
  const canMutate = can('update', 'transaction');

  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const balances = useMemo(
    () => computeRunningBalances(transactions ?? [], OPENING_BALANCE_MINOR),
    [transactions],
  );

  const filtered = useMemo(() => {
    if (!transactions) return [];
    const needle = query.trim().toLowerCase();
    const rows = transactions.filter((tx) => {
      if (direction !== 'all' && tx.direction !== direction) return false;
      if (category !== 'all' && tx.category !== category) return false;
      if (needle && !matchesTransactionQuery(tx, needle)) return false;
      return true;
    });
    return sortTransactionsNewestFirst(rows);
  }, [transactions, query, direction, category]);

  const totalIn = sumTransactions(filtered, 'in');
  const totalOut = sumTransactions(filtered, 'out');

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Input
              allowClear
              placeholder="Search"
              aria-label="Search transactions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
            />
          </div>
          <Segmented
            value={direction}
            onChange={(value) => setDirection(value as DirectionFilter)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Money in', value: 'in' },
              { label: 'Money out', value: 'out' },
            ]}
          />
          <Select
            value={category}
            onChange={setCategory}
            className="w-44"
            options={CATEGORY_OPTIONS}
            popupMatchSelectWidth={false}
          />
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          disabled={!canMutate}
          onClick={() => setAddOpen(true)}
        >
          Add transaction
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryStat label="Money in" value={formatMoney(totalIn)} tone="positive" />
        <SummaryStat label="Money out" value={formatMoney(totalOut)} tone="negative" />
        <SummaryStat label="Net" value={formatMoney(totalIn - totalOut)} />
      </div>

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load the ledger</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !isError ? (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <Skeleton active title={false} paragraph={{ rows: 6 }} />
        </div>
      ) : null}

      {!isLoading && !isError && filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <Receipt size={18} weight="bold" />
          </span>
          <p className="text-sm text-ink-soft">No transactions match this filter.</p>
        </div>
      ) : null}

      {!isLoading && !isError && filtered.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((tx) => (
            <li key={tx.id}>
              <button
                type="button"
                onClick={() => !tx.duesRecordId && setEditingTx(tx)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3 text-left transition-shadow ${
                  tx.duesRecordId
                    ? 'cursor-default'
                    : 'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                      tx.direction === 'in'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-fill text-ink-soft'
                    }`}
                  >
                    {tx.direction === 'in' ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-ink" title={tx.description}>
                        {tx.description}
                      </p>
                      {tx.duesRecordId ? (
                        <Tag color="purple" className="shrink-0">
                          From dues
                        </Tag>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-ink-muted">
                      {DATE_FMT.format(new Date(tx.date))} · {CATEGORY_LABELS[tx.category]}
                      {tx.counterparty ? ` · ${tx.counterparty}` : ''}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold ${
                      tx.direction === 'in' ? 'text-emerald-700' : 'text-ink'
                    }`}
                  >
                    {formatMoneySigned(tx.amountMinor, tx.direction)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Bal. {formatMoney(balances.get(tx.id) ?? 0)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <TransactionModal open={addOpen} transaction={null} onClose={() => setAddOpen(false)} />
      <TransactionModal
        open={editingTx !== null}
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
