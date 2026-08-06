import type { ActivityLog as ActivityLogRow } from '@prisma/client';

/** The 8 activity categories the frontend groups by. Matches
 * `ACTIVITY_CATEGORIES` in `lib/activity/activity-log.ts`. */
export const ACTIVITY_CATEGORIES = [
  'meeting',
  'education',
  'finance',
  'inventory',
  'people',
  'library',
  'task',
  'org',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Wire shape matches the web `lib/activity/activity-log.ts` `ActivityLog`
 * interface. Kept named `actorMemberId` on the wire — every UI string still
 * says "member" even though the DB column is `actorMembershipId`. */
export interface ActivityLogWire {
  id: string;
  clubId: string;
  actorMemberId: string;
  category: ActivityCategory;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  points: number;
  createdAt: string;
}

export function toActivityLogWire(row: ActivityLogRow): ActivityLogWire {
  const wire: ActivityLogWire = {
    id: row.id,
    clubId: row.clubId,
    actorMemberId: row.actorMembershipId ?? '',
    category: row.category as ActivityCategory,
    action: row.action,
    summary: row.summary,
    points: row.points,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.entityType) wire.entityType = row.entityType;
  if (row.entityId) wire.entityId = row.entityId;
  return wire;
}
