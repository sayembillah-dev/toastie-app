'use client';

import { useAppSelector } from '@/store/hooks';
import { selectActiveContextKey, selectSessionMemberships } from '@/store/session-slice';

/** The membership id the caller is acting under in their active club, or
 * `null` when they hold no membership there (super admin acting from a
 * global context, org director drilling in without joining, or nothing
 * loaded yet). Every "Me" screen card reads through this hook.
 *
 * The concept of a global "current member" — the pre-S8 stand-in — is
 * gone: a user may have memberships in many clubs, and which one they're
 * acting as is decided by `contextKey`. Callers that need a member id but
 * can't tolerate `null` (e.g. a hard-coded `/members/:id/tasks` query)
 * should render an empty state when this returns `null` rather than
 * fabricate a fallback. */
export function useCurrentMemberId(): string | null {
  const memberships = useAppSelector(selectSessionMemberships);
  const contextKey = useAppSelector(selectActiveContextKey);
  if (!contextKey?.startsWith('club:')) return null;
  const clubId = contextKey.slice('club:'.length);
  return memberships.find((m) => m.clubId === clubId)?.membershipId ?? null;
}
