'use client';

import { Plus, Wallet, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, Progress, Segmented, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

import { BudgetLineModal } from '@/components/finance/budget-line-modal';
import type { BudgetLine } from '@/lib/finance/budget';
import { CURRENT_FISCAL_YEAR, computeActuals, FISCAL_YEARS } from '@/lib/finance/budget';
import { formatMoney } from '@/lib/finance/money';
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type TransactionCategory,
} from '@/lib/finance/transactions';
import { useListBudgetLinesQuery, useListTransactionsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/** The treasurer's annual plan next to what actually happened. Actuals are
 * never stored — they're summed from the ledger on every render, so a line
 * can never drift out of sync with a transaction that was later edited. */
export function BudgetTab() {
  const [fiscalYear, setFiscalYear] = useState<string>(CURRENT_FISCAL_YEAR);
  const [addingKind, setAddingKind] = useState<'income' | 'expense' | null>(null);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);

  const {
    data: lines,
    isLoading: linesLoading,
    isError: linesError,
    error: linesErrorObj,
    refetch,
  } = useListBudgetLinesQuery(fiscalYear);
  const {
    data: transactions,
    isLoading: txsLoading,
    isError: txsError,
  } = useListTransactionsQuery();

  const actuals = useMemo(
    () => computeActuals(transactions ?? [], fiscalYear),
    [transactions, fiscalYear],
  );

  const isLoading = linesLoading || txsLoading;
  const isError = linesError || txsError;

  const budgetedCategories = new Set((lines ?? []).map((line) => line.category));

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load the budget</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(linesErrorObj)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <Segmented
          value={fiscalYear}
          onChange={(value) => setFiscalYear(value as string)}
          options={FISCAL_YEARS.map((fy) => ({ label: `FY ${fy}`, value: fy }))}
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <Skeleton active title={false} paragraph={{ rows: 6 }} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <BudgetSection
            title="Income"
            kind="income"
            categories={INCOME_CATEGORIES}
            lines={lines ?? []}
            actuals={actuals}
            budgetedCategories={budgetedCategories}
            onAdd={() => setAddingKind('income')}
            onEdit={setEditingLine}
          />
          <BudgetSection
            title="Expenses"
            kind="expense"
            categories={EXPENSE_CATEGORIES}
            lines={lines ?? []}
            actuals={actuals}
            budgetedCategories={budgetedCategories}
            onAdd={() => setAddingKind('expense')}
            onEdit={setEditingLine}
          />
        </div>
      )}

      <BudgetLineModal
        open={addingKind !== null}
        fiscalYear={fiscalYear}
        kind={addingKind ?? 'expense'}
        line={null}
        excludeCategories={budgetedCategories}
        onClose={() => setAddingKind(null)}
      />
      <BudgetLineModal
        open={editingLine !== null}
        fiscalYear={fiscalYear}
        kind={editingLine?.kind ?? 'expense'}
        line={editingLine}
        excludeCategories={budgetedCategories}
        onClose={() => setEditingLine(null)}
      />
    </div>
  );
}

interface BudgetSectionProps {
  title: string;
  kind: 'income' | 'expense';
  categories: readonly TransactionCategory[];
  lines: BudgetLine[];
  actuals: Map<TransactionCategory, number>;
  budgetedCategories: Set<TransactionCategory>;
  onAdd: () => void;
  onEdit: (line: BudgetLine) => void;
}

function BudgetSection({
  title,
  kind,
  categories,
  lines,
  actuals,
  budgetedCategories,
  onAdd,
  onEdit,
}: BudgetSectionProps) {
  const sectionLines = lines.filter((line) => line.kind === kind);
  const canAddMore = categories.some((category) => !budgetedCategories.has(category));

  const totalPlanned = sectionLines.reduce((total, line) => total + line.plannedMinor, 0);
  const totalActual = sectionLines.reduce(
    (total, line) => total + (actuals.get(line.category) ?? 0),
    0,
  );

  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Button size="small" icon={<Plus size={14} />} disabled={!canAddMore} onClick={onAdd}>
          Add line
        </Button>
      </div>

      {sectionLines.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <Wallet size={16} weight="bold" />
          </span>
          <p className="text-sm text-ink-soft">
            No {title.toLowerCase()} planned for this year yet.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sectionLines
            .slice()
            .sort((a, b) => CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]))
            .map((line) => {
              const actual = actuals.get(line.category) ?? 0;
              const percent =
                line.plannedMinor > 0 ? Math.round((actual / line.plannedMinor) * 100) : 0;
              const over = line.plannedMinor > 0 && actual > line.plannedMinor;
              const variance = line.plannedMinor - actual;
              return (
                <li key={line.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(line)}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-ink">{CATEGORY_LABELS[line.category]}</span>
                      <span className="text-ink-soft">
                        {formatMoney(actual)} / {formatMoney(line.plannedMinor)}
                      </span>
                    </div>
                    <Progress
                      percent={Math.min(percent, 100)}
                      showInfo={false}
                      size="small"
                      strokeColor={over ? '#e11d48' : '#059669'}
                    />
                    <p className={`mt-1 text-xs ${over ? 'text-rose-700' : 'text-ink-muted'}`}>
                      {over
                        ? `${formatMoney(Math.abs(variance))} over plan`
                        : `${formatMoney(variance)} remaining`}
                    </p>
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {sectionLines.length > 0 ? (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="font-medium text-ink">Total</span>
          <span className="text-ink-soft">
            {formatMoney(totalActual)} / {formatMoney(totalPlanned)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
