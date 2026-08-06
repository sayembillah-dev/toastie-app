'use client';

import { ActivityFeed } from '@/components/activity-logs/activity-feed';
import { AccessGate } from '@/components/permissions/access-gate';

/** Top-level screen for the Activity Logs page — every officer action across
 * the club, newest first. See `recordActivity()` in `local-db/handlers.ts`
 * for where these rows come from. The Club Admin dashboard's Audit Trail tab
 * renders the same `ActivityFeed` without this header. */
export function ActivityLogsScreen() {
  return (
    <AccessGate resource="activityLog">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-ink">Activity Logs</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who did what, and when — every logged action across the club.
          </p>
        </div>
        <ActivityFeed maxWidthClassName="max-w-none" />
      </div>
    </AccessGate>
  );
}
