'use client';

import {
  Bell,
  CalendarPlus,
  CheckSquare,
  ListChecks,
  Microphone,
  UserMinus,
  UserPlus,
} from '@phosphor-icons/react/dist/ssr';

import { formatNotificationTime, formatNotificationTimeFull } from '@/lib/notifications/format';
import type { AppNotification } from '@/lib/notifications/notifications';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const TYPE_ICON: Record<string, IconComponent> = {
  'meeting.published': CalendarPlus,
  'meeting.role_assigned': UserPlus,
  'meeting.role_removed': UserMinus,
  'meeting.speech_confirmed': Microphone,
  'task.assigned': ListChecks,
  'task.completed': CheckSquare,
};

interface NotificationItemProps {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
  /** Shows the club name — useful when the person belongs to more than one. */
  showClub?: boolean;
  /** Tighter padding for the header dropdown. */
  compact?: boolean;
}

/** One row in the bell dropdown and on the Notifications page. The whole row
 * is the button; unread rows get a tinted background and a dot. */
export function NotificationItem({
  notification,
  onOpen,
  showClub = false,
  compact = false,
}: NotificationItemProps) {
  const Icon = TYPE_ICON[notification.type] ?? Bell;
  const unread = !notification.read;
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`flex w-full items-start gap-3 rounded-lg text-left transition-colors hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-ink ${
        compact ? 'px-2.5 py-2' : 'p-3'
      } ${unread ? 'bg-fill' : ''}`}
    >
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-ink-soft"
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>
          {notification.title}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{notification.body}</span>
        <span className="mt-1 block text-xs text-ink-muted">
          <time
            dateTime={notification.createdAt}
            title={formatNotificationTimeFull(notification.createdAt)}
          >
            {formatNotificationTime(notification.createdAt)}
          </time>
          {showClub && notification.clubName ? ` · ${notification.clubName}` : ''}
        </span>
      </span>
      {unread ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink">
          <span className="sr-only">Unread</span>
        </span>
      ) : null}
    </button>
  );
}
