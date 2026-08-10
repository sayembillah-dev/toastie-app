'use client';

import { LockSimple } from '@phosphor-icons/react/dist/ssr';
import type { Action, ResourceKey, Target } from '@toastly/access';

import { useCan } from '@/lib/permissions/use-can';

/** Reader-friendly labels for the "Access restricted" copy — the resource
 * keys used by the engine are terse (e.g. `activityLog`), but the panel a
 * denied user sees needs a full name. Keep in sync with `RESOURCE_KEYS`. */
const RESOURCE_LABELS: Partial<Record<ResourceKey, string>> = {
  club: 'this club',
  member: 'the People directory',
  memberRole: 'Club Admin — members',
  memberPermission: 'Club Admin — permissions',
  education: 'Education',
  meeting: 'Meetings',
  meetingRole: 'meeting roles',
  checklist: 'the Sergeant at Arms checklist',
  tableTopic: 'Table Topics',
  attendance: 'attendance',
  guest: 'guests',
  guestLog: 'the guest log',
  library: 'Library',
  inventory: 'Inventory',
  transaction: 'Finance',
  budget: 'budgets',
  dues: 'dues',
  evaluation: 'evaluations',
  speechRequest: 'speech requests',
  task: 'Tasks',
  activityLog: 'the Activity Log',
  invite: 'invites',
  joinRequest: 'join requests',
  orgUnit: 'this org unit',
  report: 'reports',
};

function labelFor(resource: ResourceKey): string {
  return RESOURCE_LABELS[resource] ?? resource;
}

interface AccessGateProps {
  resource: ResourceKey;
  /** Defaults to `read` — a page gate almost always guards visibility. Pass
   * a different action for narrower gates (e.g. `update` on a settings page
   * where reading is fine but editing isn't). */
  action?: Action;
  /** Passed straight through to `can()` — used when the target's owner or
   * lineage differs from the current club (director drill-in in S13). */
  target?: Target;
  children: React.ReactNode;
}

/** Page-level read gate. The route chokepoint in `local-db/handlers.ts`
 * (`assertAccess`) is the actual authority — this just keeps a denied user
 * from seeing the data flash by before every request 403s. */
export function AccessGate({ resource, action = 'read', target, children }: AccessGateProps) {
  const { can, isLoading } = useCan();

  if (isLoading) return null;

  if (!can(action, resource, target)) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="mb-1 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <LockSimple size={18} weight="bold" />
          </span>
          <h2 className="text-lg font-semibold text-ink">Access restricted</h2>
          <p className="max-w-sm text-sm text-ink-soft">
            You don&rsquo;t have access to {labelFor(resource)}. Ask a Club Admin to grant it from
            the Club Admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
