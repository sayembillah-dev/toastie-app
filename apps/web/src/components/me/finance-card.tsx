'use client';

import { HandCoins } from '@phosphor-icons/react/dist/ssr';
import { Skeleton, Tag } from 'antd';
import Link from 'next/link';

import {
  CURRENT_DUES_PERIOD_ID,
  DUES_STATUS_LABELS,
  type DuesStatus,
  deriveDuesStatus,
  getDuesPeriod,
} from '@/lib/finance/dues';
import { formatMoney } from '@/lib/finance/money';
import { CURRENT_MEMBER_ID } from '@/lib/me/current-member';
import { useListDuesRecordsQuery } from '@/store/api';

const STATUS_TAG_COLOR: Record<DuesStatus, string> = {
  paid: 'success',
  partial: 'gold',
  unpaid: 'error',
  waived: 'purple',
};

/** Your own line in the treasurer's ledger — same records the Finance tab
 * manages, just filtered down to one member and read-only here. */
export function FinanceCard() {
  const { data: records, isLoading } = useListDuesRecordsQuery(CURRENT_DUES_PERIOD_ID);
  const record = records?.find((entry) => entry.memberId === CURRENT_MEMBER_ID);
  const period = getDuesPeriod(CURRENT_DUES_PERIOD_ID);
  const status = record ? deriveDuesStatus(record) : undefined;

  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <HandCoins size={15} weight="bold" className="text-ink-muted" />
        Dues &amp; fees
      </h2>

      {isLoading || !record || !status ? (
        <div className="mt-3">
          <Skeleton active title={false} paragraph={{ rows: 2 }} />
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-ink-soft">{period?.label ?? 'Current period'}</p>
            <Tag color={STATUS_TAG_COLOR[status]}>{DUES_STATUS_LABELS[status]}</Tag>
          </div>
          <p className="mt-2 text-lg font-semibold text-ink">
            {formatMoney(record.amountPaidMinor)}
            <span className="text-sm font-normal text-ink-muted">
              {' '}
              / {formatMoney(record.amountDueMinor)}
            </span>
          </p>
          {status === 'unpaid' || status === 'partial' ? (
            <p className="mt-1 text-[11px] text-ink-muted">
              See the{' '}
              <Link href="/finance" className="font-medium text-ink underline underline-offset-2">
                Finance
              </Link>{' '}
              tab to settle the balance with the treasurer.
            </p>
          ) : status === 'waived' ? (
            <p className="mt-1 text-[11px] text-ink-muted">Waived for this period.</p>
          ) : (
            <p className="mt-1 text-[11px] text-ink-muted">You&rsquo;re all caught up.</p>
          )}
        </div>
      )}
    </article>
  );
}
