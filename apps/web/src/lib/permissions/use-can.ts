'use client';

import type { Action, ResourceKey, Target } from '@toastly/access';
import { can as canDecide } from '@toastly/access';
import { useCallback, useMemo } from 'react';

import { sessionToSubject } from '@/lib/permissions/subject';
import { useAppSelector } from '@/store/hooks';
import {
  selectActiveContextKey,
  selectSessionMemberships,
  selectSessionOrgAssignments,
  selectSessionStatus,
  selectSessionUser,
} from '@/store/session-slice';

export interface UseCanResult {
  can: (action: Action, resource: ResourceKey, target?: Target) => boolean;
  isLoading: boolean;
}

/** Client mirror of the server chokepoint (`PermissionGuard` in
 * `apps/api/src/access`) — the UI runs the exact same `can()` from
 * `@toastly/access` against a subject built from the exact same session
 * shape the API served, so a hidden affordance and a 403'd request can
 * never disagree. Returns a bound `can(action, resource, target?)`
 * closure; while the session is still loading, `can()` returns `false`
 * (default-deny). */
export function useCan(): UseCanResult {
  const status = useAppSelector(selectSessionStatus);
  const user = useAppSelector(selectSessionUser);
  const memberships = useAppSelector(selectSessionMemberships);
  const orgAssignments = useAppSelector(selectSessionOrgAssignments);
  const contextKey = useAppSelector(selectActiveContextKey);

  const activeClubId = useMemo(() => {
    if (!contextKey || !contextKey.startsWith('club:')) return null;
    return contextKey.slice('club:'.length);
  }, [contextKey]);

  const subject = useMemo(
    () => (user ? sessionToSubject(user, memberships, orgAssignments) : null),
    [user, memberships, orgAssignments],
  );

  // useCallback rather than a useMemo that returns a function: the React
  // Compiler's `preserve-manual-memoization` rule cannot verify the memo of a
  // returned closure and fails the lint. Behaviour is unchanged — with no
  // subject this still default-denies.
  const check = useCallback(
    (action: Action, resource: ResourceKey, target?: Target) => {
      if (!subject) return false;
      // Default the target to the active club so a call site doesn't have
      // to thread `clubId` through every gated check. Callers that need
      // a different anchor (e.g. an `own`-scoped task check for a
      // different member) can pass an explicit target.
      const effective: Target | undefined =
        target ?? (activeClubId ? { clubId: activeClubId } : undefined);
      return canDecide(subject, action, resource, effective);
    },
    [subject, activeClubId],
  );

  return { can: check, isLoading: status === 'idle' };
}
