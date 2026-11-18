import type { Notification } from '@prisma/client';

export interface NotificationWire {
  id: string;
  clubId: string | null;
  /** Club name for the list's context label — null for account-level ones
   * or a club that no longer exists. */
  clubName: string | null;
  type: string;
  title: string;
  body: string;
  /** Web path to open, e.g. `/meetings/abc?tab=roles`. */
  link: string | null;
  /** Flutter route to open, e.g. `/meetings/abc/roles`; null when the app
   * has no screen for it. */
  appRoute: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPageWire {
  items: NotificationWire[];
  /** Pass back as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export function toNotificationWire(row: Notification, clubName: string | null): NotificationWire {
  return {
    id: row.id,
    clubId: row.clubId,
    clubName,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    appRoute: row.appRoute,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}
