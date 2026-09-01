'use client';

import { Empty, Skeleton, Tag } from 'antd';

import type { MyHistoryEvent } from '@/lib/profile/profile';
import { useGetMyHistoryQuery } from '@/store/api';

const KIND_LABEL: Record<MyHistoryEvent['kind'], string> = {
  visit: 'Attended',
  role: 'Role',
  speech: 'Speech',
};

/** "My History" (IDENTITY_PLAN §7a) — everywhere this account's phone number
 * has been: guest-era and member-era rows across all clubs, one
 * chronological timeline. Data is composed live via the shared `Person`,
 * so history written before the account existed shows up automatically. */
export default function MyHistoryPage() {
  const { data, isLoading } = useGetMyHistoryQuery();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">My history</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Everywhere your number has been — every club, every meeting.
      </p>

      {isLoading ? (
        <Skeleton active className="mt-6" />
      ) : !data || data.events.length === 0 ? (
        <Empty
          className="mt-10"
          description="No history yet — once a club records your number at a meeting, it shows up here."
        />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-muted">
            <Tag>{data.stats.clubsTouched} clubs</Tag>
            <Tag>{data.stats.meetingsAttended} meetings</Tag>
            <Tag>{data.stats.roles} roles</Tag>
            <Tag>{data.stats.speeches} speeches</Tag>
          </div>
          <ol className="mt-6 space-y-3">
            {data.events.map((e) => (
              <li
                key={`${e.meetingId}-${e.kind}-${e.detail ?? ''}-${e.era}`}
                className="rounded-xl border border-line bg-canvas p-3"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-ink">
                    {KIND_LABEL[e.kind]}
                    {e.detail ? `: ${e.detail}` : ''}
                  </span>
                  <Tag color={e.era === 'member' ? 'blue' : 'default'} className="text-xs">
                    {e.era === 'member' ? 'Member' : 'Guest'}
                  </Tag>
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {e.meetingLabel} · {e.clubName} · {new Date(e.date).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
