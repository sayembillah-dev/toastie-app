'use client';

import { HandCoins, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Segmented, Skeleton, Tag } from 'antd';
import { useMemo, useState } from 'react';

import { DuesPaymentModal } from '@/components/finance/dues-payment-modal';
import { getInitials } from '@/lib/education/members';
import type { DuesRecord, DuesStatus } from '@/lib/finance/dues';
import {
  CURRENT_DUES_PERIOD_ID,
  DUES_PERIODS,
  DUES_STATUS_LABELS,
  deriveDuesStatus,
  summariseDues,
} from '@/lib/finance/dues';
import { formatMoney } from '@/lib/finance/money';
import {
  useGetMembersQuery,
  useListDuesRecordsQuery,
  useUpdateDuesRecordMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const STATUS_FILTERS: (DuesStatus | 'all')[] = ['all', 'unpaid', 'partial', 'paid', 'waived'];

const STATUS_TAG_COLOR: Record<DuesStatus, string> = {
  paid: 'success',
  partial: 'gold',
  unpaid: 'default',
  waived: 'purple',
};

/** Semi-annual dues, one row per member. The roster comes from the People
 * module (`useGetMembersQuery`) — records materialise server-side on first
 * read (see `listDuesRecords` in `local-db/handlers.ts`), so a member added
 * after a period opens still shows up here. */
export function DuesTab() {
  const { message } = App.useApp();
  const [periodId, setPeriodId] = useState(CURRENT_DUES_PERIOD_ID);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DuesStatus | 'all'>('all');
  const [payingRecord, setPayingRecord] = useState<DuesRecord | null>(null);

  const { data: members } = useGetMembersQuery();
  const { data: records, isLoading, isError, error, refetch } = useListDuesRecordsQuery(periodId);
  const [updateRecord] = useUpdateDuesRecordMutation();

  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);

  const filtered = useMemo(() => {
    if (!records) return [];
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const status = deriveDuesStatus(record);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (!needle) return true;
      const member = memberById.get(record.memberId);
      const name = member ? `${member.firstName} ${member.lastName}` : '';
      return name.toLowerCase().includes(needle);
    });
  }, [records, query, statusFilter, memberById]);

  const summary = useMemo(() => summariseDues(records ?? []), [records]);

  async function handleWaive(record: DuesRecord) {
    try {
      await updateRecord({ recordId: record.id, waived: !record.waived }).unwrap();
      message.success(record.waived ? 'Waiver removed' : 'Dues waived');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this record'));
    }
  }

  async function handleReset(record: DuesRecord) {
    try {
      await updateRecord({
        recordId: record.id,
        amountPaidMinor: 0,
        waived: false,
        paidOn: null,
        method: null,
        note: null,
      }).unwrap();
      message.success('Payment cleared');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not clear this record'));
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={periodId}
          onChange={(value) => setPeriodId(value as string)}
          options={DUES_PERIODS.map((period) => ({ label: period.label, value: period.id }))}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Collected" value={formatMoney(summary.collectedMinor)} />
        <SummaryStat label="Outstanding" value={formatMoney(summary.outstandingMinor)} />
        <SummaryStat label="Paid" value={`${summary.paid}/${summary.total}`} />
        <SummaryStat label="Waived" value={String(summary.waived)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Input
            allowClear
            placeholder="Search members"
            aria-label="Search members"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
        <Segmented
          size="small"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as DuesStatus | 'all')}
          options={STATUS_FILTERS.map((status) => ({
            label: status === 'all' ? 'All' : DUES_STATUS_LABELS[status],
            value: status,
          }))}
        />
      </div>

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load dues records</p>
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
            <HandCoins size={18} weight="bold" />
          </span>
          <p className="text-sm text-ink-soft">No members match this filter.</p>
        </div>
      ) : null}

      {!isLoading && !isError && filtered.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((record) => {
            const member = memberById.get(record.memberId);
            const status = deriveDuesStatus(record);
            return (
              <li
                key={record.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-xs font-semibold text-ink-soft"
                  >
                    {member ? getInitials(member) : '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {member ? `${member.firstName} ${member.lastName}` : record.memberId}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {member?.role ?? 'Member'} · Due {formatMoney(record.amountDueMinor)}
                      {record.amountPaidMinor > 0 && status !== 'paid'
                        ? ` · Paid ${formatMoney(record.amountPaidMinor)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tag color={STATUS_TAG_COLOR[status]}>{DUES_STATUS_LABELS[status]}</Tag>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'pay',
                          label: status === 'paid' ? 'Record another payment' : 'Record payment',
                        },
                        {
                          key: 'waive',
                          label: record.waived ? 'Remove waiver' : 'Mark waived',
                        },
                        {
                          key: 'reset',
                          label: 'Reset',
                          danger: true,
                          disabled: record.amountPaidMinor === 0 && !record.waived,
                        },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'pay') setPayingRecord(record);
                        else if (key === 'waive') handleWaive(record);
                        else if (key === 'reset') handleReset(record);
                      },
                    }}
                  >
                    <Button size="small">Actions</Button>
                  </Dropdown>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <DuesPaymentModal
        open={payingRecord !== null}
        record={payingRecord}
        member={payingRecord ? memberById.get(payingRecord.memberId) : undefined}
        onClose={() => setPayingRecord(null)}
      />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-canvas px-3 py-2">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
