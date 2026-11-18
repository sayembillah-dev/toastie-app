/** Mirrors `NotificationWire` in `apps/api/src/notifications/serializers.ts`. */
export interface AppNotification {
  id: string;
  /** The club it belongs to — opening it switches there first. */
  clubId: string | null;
  clubName: string | null;
  /** e.g. `meeting.role_assigned`, `task.completed`. */
  type: string;
  title: string;
  body: string;
  /** Web path to open, e.g. `/meetings/abc?tab=roles`. */
  link: string | null;
  appRoute: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
}

export interface NotificationFilters {
  unreadOnly?: boolean;
}

/** How often the header badge re-checks the unread count. */
export const UNREAD_POLL_MS = 60_000;
