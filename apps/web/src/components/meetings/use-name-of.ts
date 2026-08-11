'use client';

import { useMemo } from 'react';

import type { Member } from '@/lib/education/members';
import { useGetMembersQuery } from '@/store/api';

/**
 * Resolves member ids to display names. The meeting tabs store ids only, so
 * every view that renders a person needs this — sharing one hook keeps them all
 * on the same "unassigned reads as empty string" contract.
 */
export function useNameOf(): (memberId: string | undefined) => string {
  const memberOf = useMemberOf();

  return useMemo(() => {
    return (memberId: string | undefined) => {
      const member = memberOf(memberId);
      return member ? `${member.firstName} ${member.lastName}` : '';
    };
  }, [memberOf]);
}

/**
 * The same lookup, but handing back the whole member rather than just a name.
 *
 * `useNameOf` builds this map already and then discards everything except the
 * name, which is why the meeting lineups could only ever render initials — the
 * avatar was one field away the whole time. Views that draw a face use this;
 * views that only print a name (the agenda builder, which produces text) stay
 * on `useNameOf`.
 */
export function useMemberOf(): (memberId: string | undefined) => Member | undefined {
  const { data: members } = useGetMembersQuery();

  return useMemo(() => {
    const byId = new Map((members ?? []).map((member) => [member.id, member]));
    return (memberId: string | undefined) => (memberId ? byId.get(memberId) : undefined);
  }, [members]);
}
