import { createApi } from '@reduxjs/toolkit/query/react';

import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';

import { localBaseQuery } from './local-base-query';

/**
 * The single data-access surface for the app. Every endpoint is written as if it
 * were already talking to the Nest API — real paths, real methods, real cache
 * invalidation. Only `baseQuery` knows the data currently lives in localStorage.
 */
export const toastlyApi = createApi({
  reducerPath: 'toastlyApi',
  baseQuery: localBaseQuery,
  tagTypes: ['Member', 'History'],
  endpoints: (build) => ({
    getMembers: build.query<Member[], void>({
      query: () => ({ url: '/members', method: 'GET' }),
      providesTags: (members) => [
        { type: 'Member', id: 'LIST' },
        ...(members ?? []).map((member) => ({ type: 'Member' as const, id: member.id })),
      ],
    }),

    getMember: build.query<Member, string>({
      query: (memberId) => ({ url: `/members/${memberId}`, method: 'GET' }),
      providesTags: (_member, _error, memberId) => [{ type: 'Member', id: memberId }],
    }),

    getMemberHistory: build.query<HistoryEvent[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/history`, method: 'GET' }),
      providesTags: (_events, _error, memberId) => [{ type: 'History', id: memberId }],
    }),

    /* Stats are derived from both the member record and their event stream, so
     * the cache entry has to answer to whichever of the two changes. */
    getMemberStats: build.query<MemberStats, string>({
      query: (memberId) => ({ url: `/members/${memberId}/stats`, method: 'GET' }),
      providesTags: (_stats, _error, memberId) => [
        { type: 'History', id: memberId },
        { type: 'Member', id: memberId },
      ],
    }),

    startPathway: build.mutation<Member, { memberId: string } & StartPathwayInput>({
      query: ({ memberId, ...body }) => ({
        url: `/members/${memberId}/pathway`,
        method: 'POST',
        body,
      }),
      // The write touches the member record, the roster card and the timeline.
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'History', id: memberId },
      ],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useGetMemberQuery,
  useGetMemberHistoryQuery,
  useGetMemberStatsQuery,
  useStartPathwayMutation,
} = toastlyApi;
