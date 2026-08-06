'use client';

import {
  AddressBook,
  BookOpen,
  ClipboardText,
  ClockCounterClockwise,
  Globe,
  GraduationCap,
  ListChecks,
  MagnifyingGlass,
  Users,
  Wallet,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input, Segmented, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import type { ActivityCategory, ActivityLog } from '@/lib/activity/activity-log';
import { ACTIVITY_CATEGORIES, matchesActivityLogQuery } from '@/lib/activity/activity-log';
import { useGetActivityLogsQuery, useGetMembersQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

type TimeRangeFilter = 'all' | 'today' | 'week' | 'month';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Phosphor icons are plain components, so the map carries the type rather
 * than an element and the row picks the size at the call site — same
 * convention as the sidebar's `NavEntry`. */
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const CATEGORY_META: Record<ActivityCategory, { label: string; Icon: IconComponent }> = {
  meeting: { label: 'Meeting', Icon: Users },
  education: { label: 'Education', Icon: GraduationCap },
  finance: { label: 'Finance', Icon: Wallet },
  inventory: { label: 'Inventory', Icon: ClipboardText },
  people: { label: 'People', Icon: AddressBook },
  library: { label: 'Library', Icon: BookOpen },
  task: { label: 'Task', Icon: ListChecks },
  org: { label: 'Org', Icon: Globe },
};

const CATEGORY_OPTIONS = [
  { label: 'All activity', value: 'all' },
  ...ACTIVITY_CATEGORIES.map((category) => ({
    label: CATEGORY_META[category].label,
    value: category,
  })),
];

/** Start-of-day cutoffs for the time-range filter, computed once per render
 * rather than per row. */
function rangeCutoff(range: TimeRangeFilter, now: Date): Date | null {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') return startOfToday;
  if (range === 'week') return new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (range === 'month') return new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
  return null;
}

/** "Today" / "Yesterday" for the two most recent days, the full date beyond
 * that — same convention as a typical activity feed. */
function dayLabel(iso: string, now: Date): string {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startOfToday.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return DATE_FMT.format(day);
}

function ActivityLogsContent() {
  const { data: logs, isLoading, isError, error, refetch } = useGetActivityLogsQuery();
  const { data: members } = useGetMembersQuery();

  const [query, setQuery] = useState('');
  const [memberId, setMemberId] = useState('all');
  const [category, setCategory] = useState<string>('all');
  const [range, setRange] = useState<TimeRangeFilter>('all');

  const membersById = useMemo(
    () => new Map((members ?? []).map((member) => [member.id, member])),
    [members],
  );

  const memberOptions = useMemo(
    () => [
      { label: 'Everyone', value: 'all' },
      ...(members ?? []).map((member) => ({
        label: `${member.firstName} ${member.lastName}`,
        value: member.id,
      })),
    ],
    [members],
  );

  const filtered = useMemo(() => {
    if (!logs) return [];
    const needle = query.trim().toLowerCase();
    const now = new Date();
    const cutoff = rangeCutoff(range, now);

    return logs.filter((log) => {
      if (memberId !== 'all' && log.actorMemberId !== memberId) return false;
      if (category !== 'all' && log.category !== category) return false;
      if (cutoff && new Date(log.createdAt) < cutoff) return false;
      if (!needle) return true;
      const actor = membersById.get(log.actorMemberId);
      const actorName = actor ? `${actor.firstName} ${actor.lastName}`.toLowerCase() : '';
      return matchesActivityLogQuery(log, needle) || actorName.includes(needle);
    });
  }, [logs, query, memberId, category, range, membersById]);

  const groups = useMemo(() => {
    const now = new Date();
    const byDay = new Map<string, { label: string; entries: ActivityLog[] }>();
    for (const log of filtered) {
      const key = log.createdAt.slice(0, 10);
      const existing = byDay.get(key);
      if (existing) {
        existing.entries.push(log);
      } else {
        byDay.set(key, { label: dayLabel(log.createdAt, now), entries: [log] });
      }
    }
    return Array.from(byDay.values());
  }, [filtered]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink">Activity Logs</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Who did what, and when — every logged action across the club.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-48">
          <Input
            allowClear
            placeholder="Search"
            aria-label="Search activity"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
        <Select
          value={memberId}
          onChange={setMemberId}
          className="w-44"
          options={memberOptions}
          popupMatchSelectWidth={false}
        />
        <Select
          value={category}
          onChange={setCategory}
          className="w-40"
          options={CATEGORY_OPTIONS}
          popupMatchSelectWidth={false}
        />
        <Segmented
          value={range}
          onChange={(value) => setRange(value as TimeRangeFilter)}
          options={[
            { label: 'All time', value: 'all' },
            { label: 'Today', value: 'today' },
            { label: '7 days', value: 'week' },
            { label: 'This month', value: 'month' },
          ]}
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
          <p className="text-sm font-medium text-ink">Could not load the activity feed</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !isError ? (
        <div className="rounded-xl border border-line bg-canvas p-4">
          <Skeleton active title={false} paragraph={{ rows: 8 }} />
        </div>
      ) : null}

      {!isLoading && !isError && groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <ClockCounterClockwise size={18} weight="bold" />
          </span>
          <p className="text-sm text-ink-soft">No activity matches this filter.</p>
        </div>
      ) : null}

      {!isLoading && !isError && groups.length > 0 ? (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2">
                {group.entries.map((log) => {
                  const actor = membersById.get(log.actorMemberId);
                  const meta = CATEGORY_META[log.category];
                  const Icon = meta.Icon;
                  return (
                    <li
                      key={log.id}
                      className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3"
                    >
                      <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{log.summary}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {actor ? `${actor.firstName} ${actor.lastName}` : 'A member'}
                          {actor ? ` · ${actor.role}` : ''} · {meta.label}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-xs text-ink-muted"
                        title={DATE_FMT.format(new Date(log.createdAt))}
                      >
                        {TIME_FMT.format(new Date(log.createdAt))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Top-level screen for the Activity Logs page — every officer action across
 * the club, newest first. See `recordActivity()` in `local-db/handlers.ts`
 * for where these rows come from. */
export function ActivityLogsScreen() {
  return (
    <AppShell>
      <ActivityLogsContent />
    </AppShell>
  );
}
