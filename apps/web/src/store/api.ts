import { createApi } from '@reduxjs/toolkit/query/react';

import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';
import type { CreateMeetingInput, Meeting, UpdateMeetingInput } from '@/lib/meetings/meetings';

import { localBaseQuery } from './local-base-query';

/**
 * The single data-access surface for the app. Every endpoint is written as if it
 * were already talking to the Nest API — real paths, real methods, real cache
 * invalidation. Only `baseQuery` knows the data currently lives in localStorage.
 */
export const toastlyApi = createApi({
  reducerPath: 'toastlyApi',
  baseQuery: localBaseQuery,
  tagTypes: ['Member', 'History', 'Meeting'],
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

    getMeetings: build.query<Meeting[], void>({
      query: () => ({ url: '/meetings', method: 'GET' }),
      providesTags: (meetings) => [
        { type: 'Meeting', id: 'LIST' },
        ...(meetings ?? []).map((meeting) => ({ type: 'Meeting' as const, id: meeting.id })),
      ],
    }),

    getMeeting: build.query<Meeting, string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}`, method: 'GET' }),
      providesTags: (_meeting, _error, meetingId) => [{ type: 'Meeting', id: meetingId }],
    }),

    /* Only the roster changes — a brand-new meeting has no detail cache entry
     * to invalidate, and the response seeds one on the way to its page. */
    createMeeting: build.mutation<Meeting, CreateMeetingInput>({
      query: (body) => ({ url: '/meetings', method: 'POST', body }),
      invalidatesTags: [{ type: 'Meeting', id: 'LIST' }],
    }),

    /* Backs both Save as Draft and Publish. The roster card carries the status
     * badge and the theme, so the list entry has to refresh alongside the
     * meeting's own cache entry. */
    updateMeeting: build.mutation<Meeting, { meetingId: string } & UpdateMeetingInput>({
      query: ({ meetingId, ...body }) => ({
        url: `/meetings/${meetingId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_meeting, _error, { meetingId }) => [
        { type: 'Meeting', id: meetingId },
        { type: 'Meeting', id: 'LIST' },
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
  useGetMeetingsQuery,
  useGetMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
} = toastlyApi;
