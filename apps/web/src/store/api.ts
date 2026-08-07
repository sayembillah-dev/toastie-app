import { createApi } from '@reduxjs/toolkit/query/react';
import type { OrgRole, OrgUnitType, SessionResponse } from '@toastly/access';
import type { ActivityLog } from '@/lib/activity/activity-log';
import type { CreateInviteInput, Invite } from '@/lib/club-admin/invites';
import type { Evaluation } from '@/lib/education/evaluations';
import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type {
  CreateMemberInput,
  Member,
  OfficerRole,
  StartPathwayInput,
  UpdateMemberInput,
} from '@/lib/education/members';
import type {
  CreateSpeechSlotRequestInput,
  SpeechSlotRequest,
} from '@/lib/education/speech-slot-requests';
import type {
  BudgetLine,
  CreateBudgetLineInput,
  UpdateBudgetLineInput,
} from '@/lib/finance/budget';
import type { DuesRecord, UpdateDuesRecordInput } from '@/lib/finance/dues';
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from '@/lib/finance/transactions';
import type {
  ChecklistItem,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@/lib/inventory/checklist';
import type {
  CreateInventoryItemInput,
  InventoryItem,
  UpdateInventoryItemInput,
} from '@/lib/inventory/inventory-items';
import type { Asset, AssetsPage, CreateAssetInput, UpdateAssetInput } from '@/lib/library/assets';
import { ASSETS_PAGE_SIZE } from '@/lib/library/assets';
import type {
  CreateDocumentInput,
  DocumentsPage,
  LibraryDocument,
  UpdateDocumentInput,
} from '@/lib/library/documents';
import { DOCUMENTS_PAGE_SIZE } from '@/lib/library/documents';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import type {
  CreateMeetingInput,
  Meeting,
  PublicMeeting,
  UpdateMeetingInput,
} from '@/lib/meetings/meetings';
import type { TimerEntry } from '@/lib/meetings/timer-reports';
import type {
  Area,
  CreateAreaInput,
  CreateDistrictInput,
  CreateDivisionInput,
  CreateOrgClubInput,
  District,
  Division,
  OrgClub,
  UpdateAreaInput,
  UpdateDistrictInput,
  UpdateDivisionInput,
  UpdateOrgClubInput,
} from '@/lib/org/types';
import type {
  ContactLog,
  CreateContactLogInput,
  UpdateContactLogInput,
} from '@/lib/people/contact-logs';
import type { Guest, UpdateGuestInput } from '@/lib/people/guests';
import type { CreateVisitLogInput, UpdateVisitLogInput, VisitLog } from '@/lib/people/visit-logs';
import type { Task, UpdateTaskInput } from '@/lib/tasks/tasks';

import { routedBaseQuery } from './routed-base-query';

interface AuthTokensResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface AuthResponse {
  tokens: AuthTokensResponse;
  session: SessionResponse;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface RegisterInput {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Optional — users can sign up with phone alone. Never used for login. */
  email?: string;
}

/**
 * The single data-access surface for the app. Every endpoint targets the live
 * Nest API through `routedBaseQuery`, which handles token attach + refresh +
 * cross-tab sign-out. Cache invalidation is written per-mutation so a
 * successful write refetches only what it actually touched.
 */
export const toastlyApi = createApi({
  reducerPath: 'toastlyApi',
  baseQuery: routedBaseQuery,
  tagTypes: [
    'Member',
    'History',
    'Meeting',
    'Guest',
    'ContactLog',
    'VisitLog',
    'Asset',
    'Document',
    'Checklist',
    'InventoryItem',
    'Transaction',
    'DuesRecord',
    'BudgetLine',
    'Evaluation',
    'TimerEntry',
    'AhCounterEntry',
    'SpeechSlotRequest',
    'Task',
    'ActivityLog',
    'District',
    'Division',
    'Area',
    'OrgClub',
    'Invite',
    'PlatformUser',
    'PlatformUserMembership',
    'OrgAssignment',
  ],
  endpoints: (build) => ({
    /* `includeRemoved` opts into seeing soft-removed members — the Club Admin
     * roster and the Activity Logs actor lookup (a past entry can reference a
     * since-removed member) both need it; every other consumer gets the
     * active-only roster by default. */
    getMembers: build.query<Member[], { includeRemoved?: boolean } | void>({
      query: (arg) => ({
        url: arg?.includeRemoved ? '/members?includeRemoved=true' : '/members',
        method: 'GET',
      }),
      providesTags: (members) => [
        { type: 'Member', id: 'LIST' },
        ...(members ?? []).map((member) => ({ type: 'Member' as const, id: member.id })),
      ],
    }),

    createMember: build.mutation<Member, CreateMemberInput>({
      query: (body) => ({ url: '/members', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateMember: build.mutation<Member, { memberId: string } & UpdateMemberInput>({
      query: ({ memberId, ...body }) => ({
        url: `/members/${memberId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    setMemberStatus: build.mutation<Member, { memberId: string; status: Member['status'] }>({
      query: ({ memberId, status }) => ({
        url: `/members/${memberId}/status`,
        method: 'POST',
        body: { status },
      }),
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    setMemberAdmin: build.mutation<Member, { memberId: string; isClubAdmin: boolean }>({
      query: ({ memberId, isClubAdmin }) => ({
        url: `/members/${memberId}/admin`,
        method: 'POST',
        body: { isClubAdmin },
      }),
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    setMemberPermissions: build.mutation<
      Member,
      { memberId: string; overrides: Record<string, 'allow' | 'deny' | 'default'> }
    >({
      query: ({ memberId, overrides }) => ({
        url: `/members/${memberId}/permissions`,
        method: 'PATCH',
        body: overrides,
      }),
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    convertGuestToMember: build.mutation<Member, { guestId: string; roles?: Member['roles'] }>({
      query: ({ guestId, roles }) => ({
        url: `/guests/${guestId}/convert-to-member`,
        method: 'POST',
        body: roles ? { roles } : {},
      }),
      invalidatesTags: (_member, _error, { guestId }) => [
        { type: 'Member', id: 'LIST' },
        { type: 'Guest', id: guestId },
        { type: 'Guest', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    getInvites: build.query<Invite[], void>({
      query: () => ({ url: '/invites', method: 'GET' }),
      providesTags: (invites) => [
        { type: 'Invite', id: 'LIST' },
        ...(invites ?? []).map((invite) => ({ type: 'Invite' as const, id: invite.id })),
      ],
    }),

    createInvite: build.mutation<Invite, CreateInviteInput>({
      query: (body) => ({ url: '/invites', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Invite', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    revokeInvite: build.mutation<Invite, string>({
      query: (inviteId) => ({ url: `/invites/${inviteId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Invite', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    convertInviteToMember: build.mutation<Member, string>({
      query: (inviteId) => ({ url: `/invites/${inviteId}/convert`, method: 'POST' }),
      invalidatesTags: [
        { type: 'Invite', id: 'LIST' },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
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
        { type: 'ActivityLog', id: 'LIST' },
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

    /* Anonymous share endpoint — matched by `isPublicUrl` in
     * `routed-base-query.ts`, so no `Authorization` header goes out and a
     * 401 doesn't trigger the refresh dance. The token is the credential;
     * a wrong or missing token surfaces as 404, deliberately opaque about
     * whether the meeting itself exists. */
    getPublicMeeting: build.query<PublicMeeting, { meetingId: string; token: string }>({
      query: ({ meetingId, token }) => ({
        url: `/public/meetings/${meetingId}?t=${encodeURIComponent(token)}`,
        method: 'GET',
      }),
    }),

    /* Only the roster changes — a brand-new meeting has no detail cache entry
     * to invalidate, and the response seeds one on the way to its page. */
    createMeeting: build.mutation<Meeting, CreateMeetingInput>({
      query: (body) => ({ url: '/meetings', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Meeting', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
        { type: 'ActivityLog', id: 'LIST' },
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
      invalidatesTags: (_guest, _error, { guestId }) => [
        { type: 'Guest', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: [
        { type: 'Guest', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'ContactLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'ContactLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'ContactLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'VisitLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'VisitLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_log, _error, { guestId }) => [
        { type: 'VisitLog', id: guestId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: [
        { type: 'Asset', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_asset, _error, { assetId }) => [
        { type: 'Asset', id: assetId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: [
        { type: 'Asset', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: [
        { type: 'Document', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: (_doc, _error, { documentId }) => [
        { type: 'Document', id: documentId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
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
      invalidatesTags: [
        { type: 'Document', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Checklist is keyed by meeting: the cache entry per meetingId is what the
     * Meeting tab and the Inventory tab both read, so a tick in one surface
     * shows up instantly in the other. */
    getChecklist: build.query<ChecklistItem[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/checklist`, method: 'GET' }),
      providesTags: (_items, _error, meetingId) => [{ type: 'Checklist', id: meetingId }],
    }),

    createChecklistItem: build.mutation<
      ChecklistItem,
      { meetingId: string } & CreateChecklistItemInput
    >({
      query: ({ meetingId, ...body }) => ({
        url: `/meetings/${meetingId}/checklist`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'Checklist', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Toggling done is the hot path — an optimistic update keeps the UI
     * checkbox feeling instant while the round trip finishes. */
    updateChecklistItem: build.mutation<
      ChecklistItem,
      { meetingId: string; itemId: string } & UpdateChecklistItemInput
    >({
      query: ({ meetingId, itemId, ...body }) => ({
        url: `/meetings/${meetingId}/checklist/${itemId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ meetingId, itemId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getChecklist', meetingId, (draft) => {
            const entry = draft.find((row) => row.id === itemId);
            if (entry) Object.assign(entry, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'Checklist', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteChecklistItem: build.mutation<null, { meetingId: string; itemId: string }>({
      query: ({ meetingId, itemId }) => ({
        url: `/meetings/${meetingId}/checklist/${itemId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ meetingId, itemId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getChecklist', meetingId, (draft) =>
            draft.filter((entry) => entry.id !== itemId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'Checklist', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Inventory items are a small single-list resource — no pagination, no
     * search. The Inventory tab reads the whole roster and filters on the
     * client. */
    listInventoryItems: build.query<InventoryItem[], void>({
      query: () => ({ url: '/inventory-items', method: 'GET' }),
      providesTags: (items) => [
        { type: 'InventoryItem', id: 'LIST' },
        ...(items ?? []).map((item) => ({ type: 'InventoryItem' as const, id: item.id })),
      ],
    }),

    createInventoryItem: build.mutation<InventoryItem, CreateInventoryItemInput>({
      query: (body) => ({ url: '/inventory-items', method: 'POST', body }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateInventoryItem: build.mutation<
      InventoryItem,
      { itemId: string } & UpdateInventoryItemInput
    >({
      query: ({ itemId, ...body }) => ({
        url: `/inventory-items/${itemId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_item, _error, { itemId }) => [
        { type: 'InventoryItem', id: itemId },
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteInventoryItem: build.mutation<null, string>({
      query: (itemId) => ({ url: `/inventory-items/${itemId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'InventoryItem', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* The whole ledger is a small single-list resource, same shape as
     * inventory items — the Transactions tab reads it all and filters on the
     * client. */
    listTransactions: build.query<Transaction[], void>({
      query: () => ({ url: '/transactions', method: 'GET' }),
      providesTags: (txs) => [
        { type: 'Transaction', id: 'LIST' },
        ...(txs ?? []).map((tx) => ({ type: 'Transaction' as const, id: tx.id })),
      ],
    }),

    createTransaction: build.mutation<Transaction, CreateTransactionInput>({
      query: (body) => ({ url: '/transactions', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Transaction', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateTransaction: build.mutation<
      Transaction,
      { transactionId: string } & UpdateTransactionInput
    >({
      query: ({ transactionId, ...body }) => ({
        url: `/transactions/${transactionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_tx, _error, { transactionId }) => [
        { type: 'Transaction', id: transactionId },
        { type: 'Transaction', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteTransaction: build.mutation<null, string>({
      query: (transactionId) => ({ url: `/transactions/${transactionId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Transaction', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Keyed by dues period — switching periods on the Dues tab hits a fresh
     * cache slot rather than refiltering one giant list. */
    listDuesRecords: build.query<DuesRecord[], string>({
      query: (periodId) => ({
        url: `/dues-records?${new URLSearchParams({ periodId }).toString()}`,
        method: 'GET',
      }),
      providesTags: (records) => [
        { type: 'DuesRecord', id: 'LIST' },
        ...(records ?? []).map((record) => ({ type: 'DuesRecord' as const, id: record.id })),
      ],
    }),

    /* Recording (or clearing) a payment writes the linked ledger entry
     * server-side, so this also invalidates the transaction list — see
     * `updateDuesRecord` in `apps/api/src/finance/finance.service.ts`. */
    updateDuesRecord: build.mutation<DuesRecord, { recordId: string } & UpdateDuesRecordInput>({
      query: ({ recordId, ...body }) => ({
        url: `/dues-records/${recordId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_record, _error, { recordId }) => [
        { type: 'DuesRecord', id: recordId },
        { type: 'DuesRecord', id: 'LIST' },
        { type: 'Transaction', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    listBudgetLines: build.query<BudgetLine[], string>({
      query: (fiscalYear) => ({
        url: `/budget-lines?${new URLSearchParams({ fiscalYear }).toString()}`,
        method: 'GET',
      }),
      providesTags: (lines) => [
        { type: 'BudgetLine', id: 'LIST' },
        ...(lines ?? []).map((line) => ({ type: 'BudgetLine' as const, id: line.id })),
      ],
    }),

    createBudgetLine: build.mutation<BudgetLine, CreateBudgetLineInput>({
      query: (body) => ({ url: '/budget-lines', method: 'POST', body }),
      invalidatesTags: [
        { type: 'BudgetLine', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateBudgetLine: build.mutation<BudgetLine, { lineId: string } & UpdateBudgetLineInput>({
      query: ({ lineId, ...body }) => ({
        url: `/budget-lines/${lineId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_line, _error, { lineId }) => [
        { type: 'BudgetLine', id: lineId },
        { type: 'BudgetLine', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteBudgetLine: build.mutation<null, string>({
      query: (lineId) => ({ url: `/budget-lines/${lineId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'BudgetLine', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* The three speech reports are keyed by member, not by an individual
     * speech — the Me page joins each report back to its `speech-given`
     * history event client-side via `speechEventId`. */
    getMemberEvaluations: build.query<Evaluation[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/evaluations`, method: 'GET' }),
      providesTags: (_evals, _error, memberId) => [{ type: 'Evaluation', id: memberId }],
    }),

    getMemberTimerEntries: build.query<TimerEntry[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/timer-entries`, method: 'GET' }),
      providesTags: (_entries, _error, memberId) => [{ type: 'TimerEntry', id: memberId }],
    }),

    getMemberAhCounterEntries: build.query<AhCounterEntry[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/ah-counter-entries`, method: 'GET' }),
      providesTags: (_entries, _error, memberId) => [{ type: 'AhCounterEntry', id: memberId }],
    }),

    getSpeechSlotRequests: build.query<SpeechSlotRequest[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/speech-slot-requests`, method: 'GET' }),
      providesTags: (_requests, _error, memberId) => [{ type: 'SpeechSlotRequest', id: memberId }],
    }),

    createSpeechSlotRequest: build.mutation<
      SpeechSlotRequest,
      { memberId: string } & CreateSpeechSlotRequestInput
    >({
      query: ({ memberId, ...body }) => ({
        url: `/members/${memberId}/speech-slot-requests`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_request, _error, { memberId }) => [
        { type: 'SpeechSlotRequest', id: memberId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    getTasks: build.query<Task[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/tasks`, method: 'GET' }),
      providesTags: (tasks, _error, memberId) => [
        { type: 'Task', id: memberId },
        ...(tasks ?? []).map((task) => ({ type: 'Task' as const, id: task.id })),
      ],
    }),

    /* Toggling done is the hot path — an optimistic update keeps the checkbox
     * feeling instant while the round trip finishes, same pattern as the
     * meeting checklist's `updateChecklistItem`. */
    updateTask: build.mutation<Task, { taskId: string; memberId: string } & UpdateTaskInput>({
      query: ({ taskId, memberId: _memberId, ...body }) => ({
        url: `/tasks/${taskId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ taskId, memberId, done }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getTasks', memberId, (draft) => {
            const task = draft.find((entry) => entry.id === taskId);
            if (task) task.done = done;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_task, _error, { taskId, memberId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: memberId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* The full feed — every officer action across the app, newest first. The
     * Activity Logs page filters on the client, same as the ledger and the
     * inventory roster. */
    getActivityLogs: build.query<ActivityLog[], void>({
      query: () => ({ url: '/activity-logs', method: 'GET' }),
      providesTags: (logs) => [
        { type: 'ActivityLog', id: 'LIST' },
        ...(logs ?? []).map((log) => ({ type: 'ActivityLog' as const, id: log.id })),
      ],
    }),

    /* --------------------------------------------------------- org tree -- */
    /* District > Division > Area > Club — the unit-switcher dashboards.
     * Every list endpoint takes an optional parent id and every write also
     * invalidates the parent-scoped list of its own type, since moving a
     * row changes which cached list it belongs in. */

    listDistricts: build.query<District[], void>({
      query: () => ({ url: '/districts', method: 'GET' }),
      providesTags: (districts) => [
        { type: 'District', id: 'LIST' },
        ...(districts ?? []).map((district) => ({ type: 'District' as const, id: district.id })),
      ],
    }),

    createDistrict: build.mutation<District, CreateDistrictInput>({
      query: (body) => ({ url: '/districts', method: 'POST', body }),
      invalidatesTags: [
        { type: 'District', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateDistrict: build.mutation<District, { districtId: string } & UpdateDistrictInput>({
      query: ({ districtId, ...body }) => ({
        url: `/districts/${districtId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_district, _error, { districtId }) => [
        { type: 'District', id: districtId },
        { type: 'District', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteDistrict: build.mutation<null, string>({
      query: (districtId) => ({ url: `/districts/${districtId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'District', id: 'LIST' },
        { type: 'Division', id: 'LIST' },
        { type: 'Area', id: 'LIST' },
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    listDivisions: build.query<Division[], string | void>({
      query: (districtId) => ({
        url: districtId
          ? `/divisions?${new URLSearchParams({ districtId }).toString()}`
          : '/divisions',
        method: 'GET',
      }),
      providesTags: (divisions) => [
        { type: 'Division', id: 'LIST' },
        ...(divisions ?? []).map((division) => ({ type: 'Division' as const, id: division.id })),
      ],
    }),

    createDivision: build.mutation<Division, CreateDivisionInput>({
      query: (body) => ({ url: '/divisions', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Division', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Also the "move" action — passing a different `districtId` reparents it. */
    updateDivision: build.mutation<Division, { divisionId: string } & UpdateDivisionInput>({
      query: ({ divisionId, ...body }) => ({
        url: `/divisions/${divisionId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_division, _error, { divisionId }) => [
        { type: 'Division', id: divisionId },
        { type: 'Division', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteDivision: build.mutation<null, string>({
      query: (divisionId) => ({ url: `/divisions/${divisionId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Division', id: 'LIST' },
        { type: 'Area', id: 'LIST' },
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    listAreas: build.query<Area[], string | void>({
      query: (divisionId) => ({
        url: divisionId ? `/areas?${new URLSearchParams({ divisionId }).toString()}` : '/areas',
        method: 'GET',
      }),
      providesTags: (areas) => [
        { type: 'Area', id: 'LIST' },
        ...(areas ?? []).map((area) => ({ type: 'Area' as const, id: area.id })),
      ],
    }),

    createArea: build.mutation<Area, CreateAreaInput>({
      query: (body) => ({ url: '/areas', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Area', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Also the "move" action — passing a different `divisionId` reparents it. */
    updateArea: build.mutation<Area, { areaId: string } & UpdateAreaInput>({
      query: ({ areaId, ...body }) => ({ url: `/areas/${areaId}`, method: 'PATCH', body }),
      invalidatesTags: (_area, _error, { areaId }) => [
        { type: 'Area', id: areaId },
        { type: 'Area', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteArea: build.mutation<null, string>({
      query: (areaId) => ({ url: `/areas/${areaId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Area', id: 'LIST' },
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    listOrgClubs: build.query<OrgClub[], string | void>({
      query: (areaId) => ({
        url: areaId ? `/org-clubs?${new URLSearchParams({ areaId }).toString()}` : '/org-clubs',
        method: 'GET',
      }),
      providesTags: (clubs) => [
        { type: 'OrgClub', id: 'LIST' },
        ...(clubs ?? []).map((club) => ({ type: 'OrgClub' as const, id: club.id })),
      ],
    }),

    createOrgClub: build.mutation<OrgClub, CreateOrgClubInput>({
      query: (body) => ({ url: '/org-clubs', method: 'POST', body }),
      invalidatesTags: [
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Also the "move" action — passing a different `areaId` reparents it. */
    updateOrgClub: build.mutation<OrgClub, { clubId: string } & UpdateOrgClubInput>({
      query: ({ clubId, ...body }) => ({ url: `/org-clubs/${clubId}`, method: 'PATCH', body }),
      invalidatesTags: (_club, _error, { clubId }) => [
        { type: 'OrgClub', id: clubId },
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteOrgClub: build.mutation<null, string>({
      query: (clubId) => ({ url: `/org-clubs/${clubId}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'OrgClub', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    authLogin: build.mutation<AuthResponse, LoginInput>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    authRegister: build.mutation<AuthResponse, RegisterInput>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    authLogout: build.mutation<void, { refreshToken: string }>({
      query: (body) => ({ url: '/auth/logout', method: 'POST', body }),
    }),
    getAuthSession: build.query<SessionResponse, void>({
      query: () => ({ url: '/auth/session', method: 'GET' }),
    }),

    /* Super Admin cross-tenant users list. Backend gates on `user:read`,
     * only reachable via the SuperAdmin bypass. `search` matches phone,
     * email, first name or last name; `page` is 1-indexed. `pageSize`
     * defaults server-side to `USERS_PAGE_SIZE` when omitted. */
    listPlatformUsers: build.query<PlatformUsersPage, ListPlatformUsersArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.search) params.set('search', args.search);
        if (args?.page && args.page > 1) params.set('page', String(args.page));
        if (args?.pageSize) params.set('pageSize', String(args.pageSize));
        const qs = params.toString();
        return { url: qs ? `/users?${qs}` : '/users', method: 'GET' };
      },
      providesTags: (page) => [
        { type: 'PlatformUser', id: 'LIST' },
        ...(page?.items ?? []).map((u) => ({ type: 'PlatformUser' as const, id: u.id })),
      ],
    }),

    setPlatformUserStatus: build.mutation<
      PlatformUser,
      { userId: string; status: 'active' | 'suspended' }
    >({
      query: ({ userId, status }) => ({
        url: `/users/${userId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_user, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'PlatformUser', id: 'LIST' },
      ],
    }),

    setPlatformUserAdmin: build.mutation<PlatformUser, { userId: string; isSuperAdmin: boolean }>({
      query: ({ userId, isSuperAdmin }) => ({
        url: `/users/${userId}/admin`,
        method: 'PATCH',
        body: { isSuperAdmin },
      }),
      invalidatesTags: (_user, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'PlatformUser', id: 'LIST' },
      ],
    }),

    /* Direct-provision — creates the account and (optionally) claims a
     * Membership in one step. Never echoes the password back; the caller's
     * own form already holds it for the credentials card it renders on
     * success. */
    createPlatformUser: build.mutation<CreatePlatformUserResult, CreatePlatformUserInput>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: [
        { type: 'PlatformUser', id: 'LIST' },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Permanent, irreversible — no soft-delete, no undo. Club memberships
     * survive (the backend FK is `onDelete: SetNull`); only the account
     * itself and everything account-scoped goes. */
    bulkDeletePlatformUsers: build.mutation<{ deletedCount: number }, string[]>({
      query: (userIds) => ({ url: '/users', method: 'DELETE', body: { userIds } }),
      invalidatesTags: [{ type: 'PlatformUser', id: 'LIST' }],
    }),

    /* --------------------------------------------- user detail panel -- */
    /* The Super Admin's full "edit this person" surface: profile fields,
     * password reset, cross-club memberships, and org-tree Director
     * assignments — everything the Users list itself doesn't cover. */

    updatePlatformUserProfile: build.mutation<
      PlatformUser,
      { userId: string } & UpdatePlatformUserProfileInput
    >({
      query: ({ userId, ...body }) => ({ url: `/users/${userId}`, method: 'PATCH', body }),
      invalidatesTags: (_user, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'PlatformUser', id: 'LIST' },
      ],
    }),

    /* Never returns the password — same rule as `createPlatformUser`. The
     * caller's own form already holds what it just sent. */
    resetPlatformUserPassword: build.mutation<void, { userId: string; password: string }>({
      query: ({ userId, password }) => ({
        url: `/users/${userId}/password`,
        method: 'POST',
        body: { password },
      }),
      invalidatesTags: (_result, _error, { userId }) => [{ type: 'PlatformUser', id: userId }],
    }),

    getPlatformUserMemberships: build.query<PlatformUserMembership[], string>({
      query: (userId) => ({ url: `/users/${userId}/memberships`, method: 'GET' }),
      providesTags: (memberships) => [
        { type: 'PlatformUserMembership', id: 'LIST' },
        ...(memberships ?? []).map((m) => ({ type: 'PlatformUserMembership' as const, id: m.id })),
      ],
    }),

    addPlatformUserMembership: build.mutation<
      Member,
      { userId: string } & AddPlatformUserMembershipInput
    >({
      query: ({ userId, ...body }) => ({
        url: `/users/${userId}/memberships`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_member, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'PlatformUserMembership', id: 'LIST' },
        { type: 'Member', id: 'LIST' },
      ],
    }),

    updatePlatformUserMembership: build.mutation<
      Member,
      { userId: string; membershipId: string } & UpdatePlatformUserMembershipInput
    >({
      query: ({ userId, membershipId, ...body }) => ({
        url: `/users/${userId}/memberships/${membershipId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_member, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'PlatformUserMembership', id: 'LIST' },
        { type: 'Member', id: 'LIST' },
      ],
    }),

    getPlatformUserOrgAssignments: build.query<PlatformUserOrgAssignment[], string>({
      query: (userId) => ({ url: `/users/${userId}/org-assignments`, method: 'GET' }),
      providesTags: (assignments) => [
        { type: 'OrgAssignment', id: 'LIST' },
        ...(assignments ?? []).map((a) => ({ type: 'OrgAssignment' as const, id: a.id })),
      ],
    }),

    addPlatformUserOrgAssignment: build.mutation<
      PlatformUserOrgAssignment,
      { userId: string } & CreateOrgAssignmentInput
    >({
      query: ({ userId, ...body }) => ({
        url: `/users/${userId}/org-assignments`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_assignment, _error, { userId }) => [
        { type: 'PlatformUser', id: userId },
        { type: 'OrgAssignment', id: 'LIST' },
      ],
    }),

    removePlatformUserOrgAssignment: build.mutation<void, { userId: string; assignmentId: string }>(
      {
        query: ({ userId, assignmentId }) => ({
          url: `/users/${userId}/org-assignments/${assignmentId}`,
          method: 'DELETE',
        }),
        invalidatesTags: (_result, _error, { userId }) => [
          { type: 'PlatformUser', id: userId },
          { type: 'OrgAssignment', id: 'LIST' },
        ],
      },
    ),
  }),
});

/** How a person is joining Toastmasters International as of this club
 * placement — new to TI, or already a member elsewhere. String-identical
 * to the backend's Prisma `MemberType` enum. */
export const MEMBER_TYPES = ['new', 'existing'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export interface PlatformUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  tiMemberNumber: string | null;
  status: 'active' | 'suspended';
  isSuperAdmin: boolean;
  membershipCount: number;
  orgAssignmentCount: number;
  createdAt: string;
}

export interface PlatformUsersPage {
  items: PlatformUser[];
  total: number;
  hasMore: boolean;
}

export interface ListPlatformUsersArgs {
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Rows-per-page choices on the Users screen — string-identical to the
 * backend's `USERS_PAGE_SIZE_OPTIONS`. */
export const PLATFORM_USERS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface CreatePlatformUserInput {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** Toastmasters International member number — a person-level identifier,
   * independent of any club placement below. */
  tiMemberNumber?: string;
  /** Omit to create a bare account with no club membership. */
  clubId?: string;
  /** Only meaningful alongside `clubId`. Absent/empty → `['Member']`. */
  roles?: OfficerRole[];
  /** Only meaningful alongside `clubId`. */
  isClubAdmin?: boolean;
  /** Only meaningful alongside `clubId`. */
  memberType?: MemberType;
}

export interface CreatePlatformUserResult extends PlatformUser {
  clubId: string | null;
  clubName: string | null;
  roles: OfficerRole[];
  isClubAdmin: boolean;
  memberType: MemberType | null;
}

/** The Super Admin user-detail panel's edit form — every field optional,
 * a save only sends what changed. */
export interface UpdatePlatformUserProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tiMemberNumber?: string;
}

/** One of a platform user's club memberships, as seen from their own detail
 * panel — a `Member` (the club-roster shape) plus which club it's on,
 * since this view spans every club at once rather than living inside one
 * club's roster page. */
export interface PlatformUserMembership extends Member {
  clubName: string;
}

export interface AddPlatformUserMembershipInput {
  clubId: string;
  /** Absent/empty → `['Member']`. */
  roles?: OfficerRole[];
  isClubAdmin?: boolean;
  memberType?: MemberType;
}

/** Every field optional — roles, the Club Admin flag and status can be
 * changed independently or together in one save. */
export interface UpdatePlatformUserMembershipInput {
  roles?: OfficerRole[];
  isClubAdmin?: boolean;
  status?: 'active' | 'removed';
}

/** An Area/Division/District Director assignment, as shown on the Super
 * Admin user-detail panel. */
export interface PlatformUserOrgAssignment {
  id: string;
  role: OrgRole;
  unitType: OrgUnitType;
  unitId: string;
  unitName: string;
  createdAt: string;
}

export interface CreateOrgAssignmentInput {
  role: OrgRole;
  unitType: OrgUnitType;
  unitId: string;
}

export const {
  useGetMembersQuery,
  useGetMemberQuery,
  useGetMemberHistoryQuery,
  useGetMemberStatsQuery,
  useStartPathwayMutation,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useSetMemberStatusMutation,
  useSetMemberAdminMutation,
  useSetMemberPermissionsMutation,
  useGetMeetingsQuery,
  useGetMeetingQuery,
  useGetPublicMeetingQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useGetGuestsQuery,
  useGetGuestQuery,
  useUpdateGuestMutation,
  useDeleteGuestMutation,
  useConvertGuestToMemberMutation,
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
  useGetChecklistQuery,
  useCreateChecklistItemMutation,
  useUpdateChecklistItemMutation,
  useDeleteChecklistItemMutation,
  useListInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useDeleteInventoryItemMutation,
  useListTransactionsQuery,
  useCreateTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useListDuesRecordsQuery,
  useUpdateDuesRecordMutation,
  useListBudgetLinesQuery,
  useCreateBudgetLineMutation,
  useUpdateBudgetLineMutation,
  useDeleteBudgetLineMutation,
  useGetMemberEvaluationsQuery,
  useGetMemberTimerEntriesQuery,
  useGetMemberAhCounterEntriesQuery,
  useGetSpeechSlotRequestsQuery,
  useCreateSpeechSlotRequestMutation,
  useGetTasksQuery,
  useUpdateTaskMutation,
  useGetActivityLogsQuery,
  useListDistrictsQuery,
  useCreateDistrictMutation,
  useUpdateDistrictMutation,
  useDeleteDistrictMutation,
  useListDivisionsQuery,
  useCreateDivisionMutation,
  useUpdateDivisionMutation,
  useDeleteDivisionMutation,
  useListAreasQuery,
  useCreateAreaMutation,
  useUpdateAreaMutation,
  useDeleteAreaMutation,
  useListOrgClubsQuery,
  useCreateOrgClubMutation,
  useUpdateOrgClubMutation,
  useDeleteOrgClubMutation,
  useGetInvitesQuery,
  useCreateInviteMutation,
  useRevokeInviteMutation,
  useConvertInviteToMemberMutation,
  useAuthLoginMutation,
  useAuthRegisterMutation,
  useAuthLogoutMutation,
  useGetAuthSessionQuery,
  useLazyGetAuthSessionQuery,
  useListPlatformUsersQuery,
  useSetPlatformUserStatusMutation,
  useSetPlatformUserAdminMutation,
  useCreatePlatformUserMutation,
  useBulkDeletePlatformUsersMutation,
  useUpdatePlatformUserProfileMutation,
  useResetPlatformUserPasswordMutation,
  useGetPlatformUserMembershipsQuery,
  useAddPlatformUserMembershipMutation,
  useUpdatePlatformUserMembershipMutation,
  useGetPlatformUserOrgAssignmentsQuery,
  useAddPlatformUserOrgAssignmentMutation,
  useRemovePlatformUserOrgAssignmentMutation,
} = toastlyApi;
