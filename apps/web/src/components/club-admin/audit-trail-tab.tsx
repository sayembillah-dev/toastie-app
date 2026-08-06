'use client';

import { ActivityFeed } from '@/components/activity-logs/activity-feed';

/** Thin wrapper around the shared feed — see `activity-feed.tsx` for the
 * filters, grouping and empty/error states. Access to this tab is already
 * gated by the `clubAdmin` module (the whole dashboard sits behind
 * `ModuleAccessGate`), so it doesn't gate itself again. */
export function AuditTrailTab() {
  return <ActivityFeed />;
}
