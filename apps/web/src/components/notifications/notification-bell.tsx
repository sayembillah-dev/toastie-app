'use client';

import { Bell } from '@phosphor-icons/react/dist/ssr';
import { Badge, Button, Popover, Spin } from 'antd';
import Link from 'next/link';
import { useState } from 'react';

import type { AppNotification } from '@/lib/notifications/notifications';
import { useOpenNotification } from '@/lib/notifications/use-open-notification';
import { useGetRecentNotificationsQuery, useMarkAllNotificationsReadMutation } from '@/store/api';
import { useAppSelector } from '@/store/hooks';
import { selectSessionMemberships } from '@/store/session-slice';

import { NotificationItem } from './notification-item';

interface NotificationBellProps {
  unreadCount: number;
}

/** Header bell: the unread badge, and a dropdown of the newest few with
 * "Mark all read" and a link to the full list. The list only loads while
 * the dropdown is open. */
export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const openNotification = useOpenNotification();
  const multiClub = useAppSelector(selectSessionMemberships).length > 1;
  const {
    data: items = [],
    isLoading,
    isError,
  } = useGetRecentNotificationsQuery(undefined, {
    skip: !open,
    refetchOnMountOrArgChange: true,
  });
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();

  const onOpen = (notification: AppNotification) => {
    setOpen(false);
    void openNotification(notification);
  };

  const content = (
    <div className="flex w-[min(360px,calc(100vw-32px))] flex-col">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="text-sm font-semibold text-ink">Notifications</span>
        <Button
          type="link"
          size="small"
          disabled={unreadCount === 0}
          loading={markingAll}
          onClick={() => void markAllRead()}
        >
          Mark all read
        </Button>
      </div>
      <div className="-mx-1 max-h-[min(420px,60vh)] overflow-y-auto px-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spin size="small" />
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-ink-soft">
            Couldn&apos;t load notifications.
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bell size={22} className="text-ink-muted" />
            <p className="text-sm text-ink-soft">You&apos;re all caught up.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} onOpen={onOpen} showClub={multiClub} compact />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-2 border-t border-line pt-2 text-center">
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-ink hover:underline"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      arrow={false}
    >
      <Button
        type="text"
        size="small"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        icon={
          <Badge count={unreadCount} size="small" offset={[2, -2]}>
            <Bell size={18} className="text-ink-soft" />
          </Badge>
        }
      />
    </Popover>
  );
}
