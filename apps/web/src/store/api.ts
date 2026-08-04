import { createApi } from '@reduxjs/toolkit/query/react';

import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';
import type { Asset, AssetsPage, CreateAssetInput, UpdateAssetInput } from '@/lib/library/assets';
import { ASSETS_PAGE_SIZE } from '@/lib/library/assets';
import type {
  CreateDocumentInput,
  DocumentsPage,
  LibraryDocument,
  UpdateDocumentInput,
} from '@/lib/library/documents';
import { DOCUMENTS_PAGE_SIZE } from '@/lib/library/documents';
import type { CreateMeetingInput, Meeting, UpdateMeetingInput } from '@/lib/meetings/meetings';
import type {
  ContactLog,
  CreateContactLogInput,
  UpdateContactLogInput,
} from '@/lib/people/contact-logs';
import type { Guest, UpdateGuestInput } from '@/lib/people/guests';
import type { CreateVisitLogInput, UpdateVisitLogInput, VisitLog } from '@/lib/people/visit-logs';

import { localBaseQuery } from './local-base-query';

/**
 * The single data-access surface for the app. Every endpoint is written as if it
 * were already talking to the Nest API — real paths, real methods, real cache
 * invalidation. Only `baseQuery` knows the data currently lives in localStorage.
 */
export const toastlyApi = createApi({
  reducerPath: 'toastlyApi',
  baseQuery: localBaseQuery,
  tagTypes: [
    'Member',
    'History',
    'Meeting',
    'Guest',
    'ContactLog',
    'VisitLog',
    'Asset',
    'Document',
  ],
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

    getGuests: build.query<Guest[], void>({
      query: () => ({ url: '/guests', method: 'GET' }),
      providesTags: (guests) => [
        { type: 'Guest', id: 'LIST' },
        ...(guests ?? []).map((guest) => ({ type: 'Guest' as const, id: guest.id })),
      ],
    }),

    getGuest: build.query<Guest, string>({
      query: (guestId) => ({ url: `/guests/${guestId}`, method: 'GET' }),
      providesTags: (_guest, _error, guestId) => [{ type: 'Guest', id: guestId }],
    }),

    /* Backs both the kanban stage drop and the edit panel — same PATCH, the
     * caller decides which fields the body carries. The cache is patched up
     * front so a moved card lands under the cursor and an edited profile shows
     * its new values before the round trip finishes; a rejection rolls both
     * back. */
    updateGuest: build.mutation<Guest, { guestId: string } & UpdateGuestInput>({
      query: ({ guestId, ...body }) => ({
        url: `/guests/${guestId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ guestId, ...changes }, { dispatch, queryFulfilled }) => {
        const listPatch = dispatch(
          toastlyApi.util.updateQueryData('getGuests', undefined, (draft) => {
            const guest = draft.find((entry) => entry.id === guestId);
            if (guest) Object.assign(guest, changes);
          }),
        );
        const detailPatch = dispatch(
          toastlyApi.util.updateQueryData('getGuest', guestId, (draft) => {
            Object.assign(draft, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          listPatch.undo();
          detailPatch.undo();
        }
      },
      invalidatesTags: (_guest, _error, { guestId }) => [{ type: 'Guest', id: guestId }],
    }),

    /* Removes the guest and drops both cache entries — the list patch pulls the
     * card out of the grid/kanban straight away, and the detail cache is reset
     * so a stale navigation back to the profile hits `getGuest` again and 404s
     * cleanly rather than reading the deleted record from memory. */
    deleteGuest: build.mutation<null, string>({
      query: (guestId) => ({ url: `/guests/${guestId}`, method: 'DELETE' }),
      onQueryStarted: async (guestId, { dispatch, queryFulfilled }) => {
        const listPatch = dispatch(
          toastlyApi.util.updateQueryData('getGuests', undefined, (draft) =>
            draft.filter((entry) => entry.id !== guestId),
          ),
        );
        try {
          await queryFulfilled;
          dispatch(toastlyApi.util.invalidateTags([{ type: 'Guest', id: guestId }]));
        } catch {
          listPatch.undo();
        }
      },
      invalidatesTags: [{ type: 'Guest', id: 'LIST' }],
    }),

    /* One cache entry per guest — the drawer scopes every read to a single
     * guest, so a per-guestId tag keeps invalidations tight. Server returns
     * newest-first so the drawer maps straight through. */
    getContactLogs: build.query<ContactLog[], string>({
      query: (guestId) => ({ url: `/guests/${guestId}/contact-logs`, method: 'GET' }),
      providesTags: (_logs, _error, guestId) => [{ type: 'ContactLog', id: guestId }],
    }),

    /* Optimistic prepend so the just-typed entry lands at the top before the
     * server acknowledges. Server assigns id/createdAt — invalidation on
     * success swaps the placeholder for the real record. */
    createContactLog: build.mutation<ContactLog, { guestId: string } & CreateContactLogInput>({
      query: ({ guestId, ...body }) => ({
        url: `/guests/${guestId}/contact-logs`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'ContactLog', id: guestId }],
    }),

    updateContactLog: build.mutation<
      ContactLog,
      { guestId: string; logId: string } & UpdateContactLogInput
    >({
      query: ({ guestId, logId, ...body }) => ({
        url: `/guests/${guestId}/contact-logs/${logId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ guestId, logId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getContactLogs', guestId, (draft) => {
            const entry = draft.find((log) => log.id === logId);
            if (entry) Object.assign(entry, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'ContactLog', id: guestId }],
    }),

    deleteContactLog: build.mutation<null, { guestId: string; logId: string }>({
      query: ({ guestId, logId }) => ({
        url: `/guests/${guestId}/contact-logs/${logId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ guestId, logId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getContactLogs', guestId, (draft) =>
            draft.filter((entry) => entry.id !== logId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'ContactLog', id: guestId }],
    }),

    /* Same shape as the contact-log endpoints — one cache entry per guest,
     * server sorts newest meeting first so the client maps straight through. */
    getVisitLogs: build.query<VisitLog[], string>({
      query: (guestId) => ({ url: `/guests/${guestId}/visit-logs`, method: 'GET' }),
      providesTags: (_logs, _error, guestId) => [{ type: 'VisitLog', id: guestId }],
    }),

    createVisitLog: build.mutation<VisitLog, { guestId: string } & CreateVisitLogInput>({
      query: ({ guestId, ...body }) => ({
        url: `/guests/${guestId}/visit-logs`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'VisitLog', id: guestId }],
    }),

    updateVisitLog: build.mutation<
      VisitLog,
      { guestId: string; logId: string } & UpdateVisitLogInput
    >({
      query: ({ guestId, logId, ...body }) => ({
        url: `/guests/${guestId}/visit-logs/${logId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ guestId, logId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getVisitLogs', guestId, (draft) => {
            const entry = draft.find((log) => log.id === logId);
            if (entry) Object.assign(entry, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'VisitLog', id: guestId }],
    }),

    deleteVisitLog: build.mutation<null, { guestId: string; logId: string }>({
      query: ({ guestId, logId }) => ({
        url: `/guests/${guestId}/visit-logs/${logId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ guestId, logId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getVisitLogs', guestId, (draft) =>
            draft.filter((entry) => entry.id !== logId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_log, _error, { guestId }) => [{ type: 'VisitLog', id: guestId }],
    }),

    /* Paginated with a merge strategy: every offset for the same `q` folds
     * into a single cache entry, so an infinite-scroll listener can call the
     * hook repeatedly with a bumped `offset` and the UI reads one growing
     * list rather than an array of pages. Switching `q` reseeds the entry.
     * `nextOffset` is carried alongside so the caller knows when to stop. */
    listAssets: build.query<AssetsPage, { q: string; offset: number }>({
      query: ({ q, offset }) => {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(ASSETS_PAGE_SIZE),
        });
        if (q) params.set('q', q);
        return { url: `/assets?${params.toString()}`, method: 'GET' };
      },
      /* Serialise by search only — every offset lands in the same cache slot
       * so pages append instead of shard. */
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}:${queryArgs.q}`,
      merge: (currentCache, incoming, { arg }) => {
        if (arg.offset === 0) {
          currentCache.items = incoming.items;
        } else {
          const seen = new Set(currentCache.items.map((asset) => asset.id));
          currentCache.items = currentCache.items.concat(
            incoming.items.filter((asset) => !seen.has(asset.id)),
          );
        }
        currentCache.total = incoming.total;
        currentCache.nextOffset = incoming.nextOffset;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.q !== previousArg?.q || currentArg?.offset !== previousArg?.offset,
      providesTags: (page) => [
        { type: 'Asset' as const, id: 'LIST' },
        ...(page?.items ?? []).map((asset) => ({ type: 'Asset' as const, id: asset.id })),
      ],
    }),

    createAsset: build.mutation<Asset, CreateAssetInput>({
      query: (body) => ({ url: '/assets', method: 'POST', body }),
      invalidatesTags: [{ type: 'Asset', id: 'LIST' }],
    }),

    /* Optimistic title edit against every cached asset list — the record
     * shows up in as many `q` buckets as the user has scrolled through, and
     * they should all reflect the new title on the way to the server. */
    updateAsset: build.mutation<Asset, { assetId: string } & UpdateAssetInput>({
      query: ({ assetId, ...body }) => ({
        url: `/assets/${assetId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ assetId, ...changes }, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'Asset', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listAssets')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listAssets',
                entry.originalArgs as { q: string; offset: number },
                (draft) => {
                  const asset = draft.items.find((item) => item.id === assetId);
                  if (asset) Object.assign(asset, changes);
                },
              ),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      invalidatesTags: (_asset, _error, { assetId }) => [{ type: 'Asset', id: assetId }],
    }),

    /* Same broadcast pattern as the title edit — drop the row from every
     * cached list at once so the grid closes over the gap before the round
     * trip finishes. */
    deleteAsset: build.mutation<null, string>({
      query: (assetId) => ({ url: `/assets/${assetId}`, method: 'DELETE' }),
      onQueryStarted: async (assetId, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'Asset', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listAssets')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listAssets',
                entry.originalArgs as { q: string; offset: number },
                (draft) => {
                  draft.items = draft.items.filter((asset) => asset.id !== assetId);
                  draft.total = Math.max(0, draft.total - 1);
                },
              ),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      invalidatesTags: [{ type: 'Asset', id: 'LIST' }],
    }),

    /* Same paginate-and-merge shape as `listAssets`: every offset for a given
     * `q` folds into one cache entry so the infinite-scroll listener can
     * bump `offset` and the UI reads a single growing list. */
    listDocuments: build.query<DocumentsPage, { q: string; offset: number }>({
      query: ({ q, offset }) => {
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(DOCUMENTS_PAGE_SIZE),
        });
        if (q) params.set('q', q);
        return { url: `/documents?${params.toString()}`, method: 'GET' };
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}:${queryArgs.q}`,
      merge: (currentCache, incoming, { arg }) => {
        if (arg.offset === 0) {
          currentCache.items = incoming.items;
        } else {
          const seen = new Set(currentCache.items.map((doc) => doc.id));
          currentCache.items = currentCache.items.concat(
            incoming.items.filter((doc) => !seen.has(doc.id)),
          );
        }
        currentCache.total = incoming.total;
        currentCache.nextOffset = incoming.nextOffset;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.q !== previousArg?.q || currentArg?.offset !== previousArg?.offset,
      providesTags: (page) => [
        { type: 'Document' as const, id: 'LIST' },
        ...(page?.items ?? []).map((doc) => ({ type: 'Document' as const, id: doc.id })),
      ],
    }),

    createDocument: build.mutation<LibraryDocument, CreateDocumentInput>({
      query: (body) => ({ url: '/documents', method: 'POST', body }),
      invalidatesTags: [{ type: 'Document', id: 'LIST' }],
    }),

    /* Optimistic title edit across every cached document list — a rename
     * should show up in the same beat in whichever `q` buckets the user has
     * scrolled through. */
    updateDocument: build.mutation<LibraryDocument, { documentId: string } & UpdateDocumentInput>({
      query: ({ documentId, ...body }) => ({
        url: `/documents/${documentId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async (
        { documentId, ...changes },
        { dispatch, getState, queryFulfilled },
      ) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'Document', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listDocuments')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listDocuments',
                entry.originalArgs as { q: string; offset: number },
                (draft) => {
                  const doc = draft.items.find((item) => item.id === documentId);
                  if (doc) Object.assign(doc, changes);
                },
              ),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      invalidatesTags: (_doc, _error, { documentId }) => [{ type: 'Document', id: documentId }],
    }),

    deleteDocument: build.mutation<null, string>({
      query: (documentId) => ({ url: `/documents/${documentId}`, method: 'DELETE' }),
      onQueryStarted: async (documentId, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'Document', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listDocuments')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listDocuments',
                entry.originalArgs as { q: string; offset: number },
                (draft) => {
                  draft.items = draft.items.filter((doc) => doc.id !== documentId);
                  draft.total = Math.max(0, draft.total - 1);
                },
              ),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      invalidatesTags: [{ type: 'Document', id: 'LIST' }],
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
  useGetGuestsQuery,
  useGetGuestQuery,
  useUpdateGuestMutation,
  useDeleteGuestMutation,
  useGetContactLogsQuery,
  useCreateContactLogMutation,
  useUpdateContactLogMutation,
  useDeleteContactLogMutation,
  useGetVisitLogsQuery,
  useCreateVisitLogMutation,
  useUpdateVisitLogMutation,
  useDeleteVisitLogMutation,
  useListAssetsQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  useListDocumentsQuery,
  useCreateDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
} = toastlyApi;
