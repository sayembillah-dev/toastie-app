'use client';

import { ArrowsLeftRight, ChartPieSlice, HandCoins, Wallet } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { BudgetTab } from '@/components/finance/budget-tab';
import { DuesTab } from '@/components/finance/dues-tab';
import { OverviewTab } from '@/components/finance/overview-tab';
import { TransactionsTab } from '@/components/finance/transactions-tab';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';

/** Tabs live on the Finance page so every treasurer surface shares the same
 * header, breadcrumb and content padding — same shell as Inventory, Library
 * and People. */
export function FinanceTabs() {
  const { activeKey, onChange } = usePersistentTab('tab', 'overview');
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Finance</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The treasurer&rsquo;s workspace — dues, the ledger and the budget, all in one place.
        </p>
      </header>

      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        size="middle"
        items={[
          {
            key: 'overview',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ChartPieSlice size={14} weight="bold" />
                Overview
              </span>
            ),
            children: <OverviewTab />,
          },
          {
            key: 'dues',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <HandCoins size={14} weight="bold" />
                Dues &amp; renewals
              </span>
            ),
            children: <DuesTab />,
          },
          {
            key: 'transactions',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ArrowsLeftRight size={14} weight="bold" />
                Transactions
              </span>
            ),
            children: <TransactionsTab />,
          },
          {
            key: 'budget',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Wallet size={14} weight="bold" />
                Budget
              </span>
            ),
            children: <BudgetTab />,
          },
        ]}
      />
    </div>
  );
}
