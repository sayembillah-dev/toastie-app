'use client';

import { CURRENT_MEMBER_ID } from '@/lib/me/current-member';
import type { ModuleKey, ModulePermission } from '@/lib/permissions/permissions';
import { getEffectivePermission } from '@/lib/permissions/permissions';
import { useGetMemberQuery } from '@/store/api';

/** Client-side mirror of the server-side chokepoint in
 * `local-db/handlers.ts` (`assertModuleAccess`) — same `getEffectivePermission`
 * call, same `CURRENT_MEMBER_ID` stand-in for a session, so the UI and the
 * API can never disagree about who can do what. Used to hide/disable
 * affordances; the route chokepoint is what actually enforces it. */
export function usePermission(module: ModuleKey): ModulePermission & { isLoading: boolean } {
  const { data: member, isLoading } = useGetMemberQuery(CURRENT_MEMBER_ID);

  if (!member) return { read: false, mutate: false, isLoading };

  return { ...getEffectivePermission(member, module), isLoading };
}
