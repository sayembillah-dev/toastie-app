'use client';

import { ActivityFeed } from '@/components/activity-logs/activity-feed';

/** Thin wrapper around the shared feed — see `activity-feed.tsx` for the
 * filters, grouping and empty/error states. Access to this tab is already
 * gated by the `activityLog` read check on the parent page (`AccessGate`),
 * so it doesn't gate itself again. */
export function AuditTrailTab() {
  return <ActivityFeed />;
}
