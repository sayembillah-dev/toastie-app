'use client';

import { useMemo } from 'react';

import { useGetMembersQuery } from '@/store/api';

/**
 * Resolves member ids to display names. The meeting tabs store ids only, so
 * every view that renders a person needs this — sharing one hook keeps them all
 * on the same "unassigned reads as empty string" contract.
 */
export function useNameOf(): (memberId: string | undefined) => string {
  const { data: members } = useGetMembersQuery();

  return useMemo(() => {
    const byId = new Map((members ?? []).map((member) => [member.id, member]));
    return (memberId: string | undefined) => {
      const member = memberId ? byId.get(memberId) : undefined;
      return member ? `${member.firstName} ${member.lastName}` : '';
    };
  }, [members]);
}
