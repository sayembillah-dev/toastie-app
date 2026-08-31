/**
 * The rendering-side half of authorization.
 *
 * Screens ask `can(...)` to decide what to show. They never re-implement a
 * permission rule (docs/IMPLEMENTATION_PLAN.md section 1.2) — a check written
 * inline in a screen is a rule the API does not share, and the two will drift.
 *
 * This is the client mirror of the server chokepoint (`PermissionGuard` in
 * `apps/api/src/access`), and is deliberately the same shape as the web app's
 * `useCan` so the two clients hide and show the same controls.
 *
 * A subject of `null` (still restoring, or a user who belongs to no club yet)
 * denies everything, which is the right default for both states.
 */

import type { Action, ResourceKey, Target } from '@toastly/access';
import { can as canDecide } from '@toastly/access';
import { useCallback } from 'react';

import { useSession } from './session-provider';

export type CanFn = (action: Action, resource: ResourceKey, target?: Target) => boolean;

export function useCan(): CanFn {
  const { subject, activeContext } = useSession();
  const activeClubId = activeContext?.kind === 'club' ? activeContext.clubId : null;

  return useCallback(
    (action, resource, target) => {
      if (!subject) return false;
      // The subject carries every assignment the user holds, so an untargeted
      // check would match any club they belong to. Default the target to the
      // active club — a call site that needs a different anchor (an `own`-scoped
      // check for another member, say) passes one explicitly.
      const effective: Target | undefined =
        target ?? (activeClubId ? { clubId: activeClubId } : undefined);
      return canDecide(subject, action, resource, effective);
    },
    [subject, activeClubId],
  );
}
