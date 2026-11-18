'use client';

import { Bell } from '@phosphor-icons/react/dist/ssr';
import { Button, Segmented, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { useOpenNotification } from '@/lib/notifications/use-open-notification';
import {
  useGetUnreadNotificationCountQuery,
  useListNotificationsInfiniteQuery,
  useMarkAllNotificationsReadMutation,
} from '@/store/api';
import { useAppSelector } from '@/store/hooks';
import { selectSessionMemberships } from '@/store/session-slice';

import { NotificationItem } from './notification-item';

type Filter = 'all' | 'unread';

/** Every notification for the signed-in account, newest first, across all
 * their clubs. Scrolls in more pages as the end comes into view. */
export function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const openNotification = useOpenNotification();
  const multiClub = useAppSelector(selectSessionMemberships).length > 1;
  const { data: unreadCount = 0 } = useGetUnreadNotificationCountQuery();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useListNotificationsInfiniteQuery({ unreadOnly: filter === 'unread' });
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-ink-soft">
            {unreadCount > 0 ? `${unreadCount} unread` : 'Nothing unread'}
          </p>
        </div>
        <Button
          disabled={unreadCount === 0}
          loading={markingAll}
          onClick={() => void markAllRead()}
        >
          Mark all read
        </Button>
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { label: 'All', value: 'all' },
          { label: 'Unread', value: 'unread' },
        ]}
        className="self-start"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spin />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-ink-soft">Couldn&apos;t load your notifications.</p>
          <Button onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-fill text-ink-muted">
            <Bell size={20} />
          </span>
          <p className="text-sm font-medium text-ink">
            {filter === 'unread' ? "You're all caught up" : 'No notifications yet'}
          </p>
          <p className="max-w-xs text-sm text-ink-soft">
            Role assignments, confirmed speeches, new meetings and tasks will show up here.
          </p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onOpen={(item) => void openNotification(item)}
                  showClub={multiClub}
                />
              </li>
            ))}
          </ul>
          {isFetchingNextPage ? (
            <div className="flex justify-center py-2">
              <Spin size="small" />
            </div>
          ) : null}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
