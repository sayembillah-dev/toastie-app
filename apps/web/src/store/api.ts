import { createApi } from '@reduxjs/toolkit/query/react';
import type { OrgRole, OrgUnitType, SessionResponse } from '@toastly/access';
import type { ActivityLog } from '@/lib/activity/activity-log';
import type { ClubProfile, UpdateClubProfileInput } from '@/lib/club/club-profile';
import type { CreateInviteInput, Invite } from '@/lib/club-admin/invites';
import type { Evaluation } from '@/lib/education/evaluations';
import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type {
  BulkCreateMembersResult,
  CreateMemberInput,
  Member,
  OfficerRole,
  StartPathwayInput,
  UpdateMemberInput,
} from '@/lib/education/members';
import type { PlannerRowWire, UpdatePlannerRowInput } from '@/lib/education/planner';
import type {
  CreateSpeechSlotRequestInput,
  SpeechSlotRequest,
} from '@/lib/education/speech-slot-requests';
import type {
  EvaluationSubmissionWire,
  SignEvaluationUploadInput,
  SignedEvaluationUpload,
  SubmitEvaluationInput,
} from '@/lib/evaluation/api-types';
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
import type {
  CreatePlannerIdeaInput,
  PlannerIdea,
  UpdatePlannerIdeaInput,
} from '@/lib/library/planner';
import type { PublicAgendaSpeakerSource } from '@/lib/meetings/agenda-speaker-sources';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import type {
  CreateGuestAttendanceInput,
  GuestAttendance,
  MarkAllAttendanceResult,
  MemberAttendance,
  UpdateGuestAttendanceInput,
} from '@/lib/meetings/attendance';
import type {
  CreateMeetingInput,
  Meeting,
  PublicMeeting,
  PublicRoleAssignment,
  PublicSpeaker,
  UpdateMeetingInput,
} from '@/lib/meetings/meetings';
import type {
  PreparedSpeakerWire,
  UpdatePreparedSpeakerInput,
} from '@/lib/meetings/prepared-speakers';
import type { PublicMeetingAgenda } from '@/lib/meetings/public-agenda';
import type { RoleAssignment } from '@/lib/meetings/role-assignments';
import type {
  CreateTableTopicQuestionInput,
  TableTopicQuestion,
  UpdateTableTopicQuestionInput,
} from '@/lib/meetings/table-topics';
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
import type {
  ConvertGuestResult,
  CreateGuestInput,
  Guest,
  GuestInviteLink,
  GuestMatch,
  PublicGuestInvitePreview,
  SubmitGuestInviteInput,
  UpdateGuestInput,
} from '@/lib/people/guests';
import type { CreateVisitLogInput, UpdateVisitLogInput, VisitLog } from '@/lib/people/visit-logs';
import type { Profile, UpdateProfileInput } from '@/lib/profile/profile';
import type { PushSubscriptionInput } from '@/lib/push/push-notifications';
import type {
  CreateTaskInput,
  CreateTaskNoteInput,
  Task,
  UpdateTaskInput,
} from '@/lib/tasks/tasks';

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
    'PlannerRow',
    'Meeting',
    'Guest',
    'ContactLog',
    'VisitLog',
    'Asset',
    'Document',
    'PlannerIdea',
    'Checklist',
    'MeetingRoleAssignment',
    'PreparedSpeaker',
    'TableTopicQuestion',
    'MeetingAttendance',
    'MeetingGuestAttendance',
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
    'Profile',
    'ClubProfile',
    'ReceivedEvaluation',
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

    /* The bulk-add table's submit — one request for the whole grid. Rows
     * that conflict come back in `failed`; the rest land on the roster. */
    bulkCreateMembers: build.mutation<BulkCreateMembersResult, CreateMemberInput[]>({
      query: (members) => ({ url: '/members/bulk', method: 'POST', body: { members } }),
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
      /* Optimistic so the permissions grid's checkboxes flip on click rather
       * than after the round-trip. Mirrors the server's merge semantics —
       * `default` deletes the key, anything else sets it — so the patched
       * cache matches what the refetch will bring back. */
      onQueryStarted: async ({ memberId, overrides }, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'Member', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'getMembers')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'getMembers',
                entry.originalArgs as { includeRemoved?: boolean } | undefined,
                (draft) => {
                  const member = draft.find((item) => item.id === memberId);
                  if (!member) return;
                  const next = { ...(member.overrides ?? {}) };
                  for (const [key, value] of Object.entries(overrides)) {
                    if (value === 'default') delete next[key];
                    else next[key] = value;
                  }
                  member.overrides = next;
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
      invalidatesTags: (_member, _error, { memberId }) => [
        { type: 'Member', id: memberId },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    convertGuestToMember: build.mutation<
      ConvertGuestResult,
      { guestId: string; roles?: Member['roles'] }
    >({
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

    /* Anonymous landing-page preview — matched by `isPublicUrl` in
     * `routed-base-query.ts`, so no `Authorization` header goes out. Tells
     * `/invite/:token` which club/role(s) the link grants (or that it's
     * expired/used/revoked) before the visitor signs in. */
    getPublicInvitePreview: build.query<InvitePreview, string>({
      query: (token) => ({ url: `/public/invites/${token}`, method: 'GET' }),
    }),

    /* Authed accept — the caller isn't a member of the target club yet, so
     * there's no club context to send; the invite's own clubId drives it
     * server-side. */
    acceptInvite: build.mutation<AcceptedInvite, string>({
      query: (token) => ({ url: `/invites/${token}/accept`, method: 'POST' }),
      invalidatesTags: [
        { type: 'Invite', id: 'LIST' },
        { type: 'Member', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Backed by `@Public()` on the server, but fetched with the normal authed
     * baseQuery rather than the `/public/*` one — the caller here is always
     * a signed-in, clubless user browsing from the onboarding screen, so
     * there's a token to attach and no reason to duplicate `publicFetch`. */
    getPublicClubDirectory: build.query<PublicClub[], void>({
      query: () => ({ url: '/clubs/directory', method: 'GET' }),
    }),

    /* Club Admin's own dashboard reading its club's standing join code —
     * needs an active club context (`X-Toastly-Context`), which the normal
     * authed baseQuery already attaches. */
    getClubJoinCode: build.query<{ code: string }, void>({
      query: () => ({ url: '/clubs/join-code', method: 'GET' }),
    }),

    /* Club Admin's Club Profile page — name, motto, venue, socials, etc for
     * their own club. Same active-club-context reasoning as
     * `getClubJoinCode`; distinct from `updateOrgClub` below, which is the
     * director-facing directory CRUD. */
    getClubProfile: build.query<ClubProfile, void>({
      query: () => ({ url: '/clubs/mine', method: 'GET' }),
      providesTags: ['ClubProfile'],
    }),
    updateClubProfile: build.mutation<ClubProfile, UpdateClubProfileInput>({
      query: (body) => ({ url: '/clubs/mine', method: 'PATCH', body }),
      invalidatesTags: ['ClubProfile', { type: 'ActivityLog', id: 'LIST' }],
    }),

    /* Clubless-onboarding counterpart to `acceptInvite` — same "no club
     * context yet" reasoning, keyed by the standing code instead of a
     * single-use token. */
    joinClubByCode: build.mutation<JoinedClub, string>({
      query: (code) => ({ url: '/clubs/join-by-code', method: 'POST', body: { code } }),
      invalidatesTags: [{ type: 'Member', id: 'LIST' }],
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

    /* Education > Planner grid rows. Every cell edit is its own mutation —
     * optimistic so a wide, fast-typing grid never visibly reverts mid-edit. */
    getPlannerRows: build.query<PlannerRowWire[], void>({
      query: () => ({ url: '/planner-rows', method: 'GET' }),
      providesTags: (rows) => [
        { type: 'PlannerRow', id: 'LIST' },
        ...(rows ?? []).map((row) => ({ type: 'PlannerRow' as const, id: row.id })),
      ],
    }),

    createPlannerRow: build.mutation<PlannerRowWire, void>({
      query: () => ({ url: '/planner-rows', method: 'POST' }),
      invalidatesTags: [{ type: 'PlannerRow', id: 'LIST' }],
    }),

    updatePlannerRow: build.mutation<PlannerRowWire, { rowId: string } & UpdatePlannerRowInput>({
      query: ({ rowId, ...body }) => ({ url: `/planner-rows/${rowId}`, method: 'PATCH', body }),
      onQueryStarted: async ({ rowId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getPlannerRows', undefined, (draft) => {
            const entry = draft.find((row) => row.id === rowId);
            if (entry) Object.assign(entry, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      /* A row linked to a meeting can carry number/date/theme/assignee edits
       * onto that meeting server-side (see `syncMeetingFromPlannerRow`) — bust
       * its caches too so the Meeting page, Roles tab and Prepared Speakers
       * tab pick the mirrored change up without a manual refresh. */
      invalidatesTags: (row, _error, { rowId }) => [
        { type: 'PlannerRow', id: rowId },
        ...(row?.meetingId
          ? ([
              { type: 'Meeting', id: row.meetingId },
              { type: 'MeetingRoleAssignment', id: row.meetingId },
              { type: 'PreparedSpeaker', id: row.meetingId },
            ] as const)
          : []),
      ],
    }),

    deletePlannerRow: build.mutation<null, { rowId: string }>({
      query: ({ rowId }) => ({ url: `/planner-rows/${rowId}`, method: 'DELETE' }),
      onQueryStarted: async ({ rowId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getPlannerRows', undefined, (draft) =>
            draft.filter((row) => row.id !== rowId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'PlannerRow', id: 'LIST' }],
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

    /* Backs the evaluation form's header. Same no-auth routing and token
     * gate as `getPublicMeeting` — works while the meeting is still a draft. */
    getPublicSpeaker: build.query<
      PublicSpeaker,
      { meetingId: string; speakerId: string; token: string }
    >({
      query: ({ meetingId, speakerId, token }) => ({
        url: `/public/meetings/${meetingId}/speakers/${speakerId}?t=${encodeURIComponent(token)}`,
        method: 'GET',
      }),
    }),

    /* Backs the Ah Counter/Timer/Grammarian pages' identity gate. Same
     * no-auth routing and token gate as `getPublicMeeting`. */
    getPublicRoleAssignment: build.query<
      PublicRoleAssignment,
      { meetingId: string; role: string; token: string }
    >({
      query: ({ meetingId, role, token }) => ({
        url: `/public/meetings/${meetingId}/roles/${role}?t=${encodeURIComponent(token)}`,
        method: 'GET',
      }),
    }),

    /* Backs the public Ah Counter/Timer "Take from agenda" button — same
     * no-auth routing and token gate as `getPublicMeeting`. Server-computed
     * equivalent of `buildAgendaSpeakerSources`, since an anonymous caller
     * can't reach `/members`, `/guests`, or the authenticated roles/prepared-
     * speakers endpoints that function normally reads from. */
    getPublicAgendaSpeakerSources: build.query<
      PublicAgendaSpeakerSource[],
      { meetingId: string; token: string }
    >({
      query: ({ meetingId, token }) => ({
        url: `/public/meetings/${meetingId}/roles/agenda-speakers?t=${encodeURIComponent(token)}`,
        method: 'GET',
      }),
    }),

    /* Public agenda endpoint — matched by `isPublicUrl` the same as
     * `getPublicMeeting`, but gated by the meeting's `published` status
     * rather than a share token: anyone with the meeting id can view it
     * once it's published. A draft meeting 404s the same as an unknown id. */
    getPublicMeetingAgenda: build.query<PublicMeetingAgenda, string>({
      query: (meetingId) => ({ url: `/public/meetings/${meetingId}/agenda`, method: 'GET' }),
    }),

    /* Mints a presigned PUT for the evaluator's audio/image before `submit`.
     * `/public/*` — same no-auth routing as `getPublicMeeting`. */
    signPublicEvaluationUpload: build.mutation<SignedEvaluationUpload, SignEvaluationUploadInput>({
      query: ({ meetingId, speakerId, token, ...body }) => ({
        url: `/public/meetings/${meetingId}/speakers/${speakerId}/evaluations/sign?t=${encodeURIComponent(token)}`,
        method: 'POST',
        body,
      }),
    }),

    /* Re-validates the share token server-side on every call — see
     * `PublicEvaluationsController`. Not tagged/invalidated: the submitter
     * has no cache entry of their own to refresh (they're anonymous), and
     * the officer-facing badge count comes from `getPreparedSpeakers`
     * instead, refetched on its own schedule. */
    submitPublicEvaluation: build.mutation<{ id: string }, SubmitEvaluationInput>({
      query: ({ meetingId, speakerId, token, ...body }) => ({
        url: `/public/meetings/${meetingId}/speakers/${speakerId}/evaluations?t=${encodeURIComponent(token)}`,
        method: 'POST',
        body,
      }),
    }),

    /* Feeds the Me page's "Peer feedback" section — evaluations this member
     * received through their shareable evaluation link. Authenticated: a
     * member sees their own (own-scope grant), officers see the club's. */
    getReceivedEvaluations: build.query<EvaluationSubmissionWire[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/received-evaluations`, method: 'GET' }),
      providesTags: (_rows, _error, memberId) => [{ type: 'ReceivedEvaluation', id: memberId }],
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
      /* Number/date/theme edits here can carry onto a linked planner row
       * server-side (see `syncPlannerFieldsFromMeeting`) — bust the grid's
       * cache too so it doesn't show a stale value until next visit. */
      invalidatesTags: (_meeting, _error, { meetingId }) => [
        { type: 'Meeting', id: meetingId },
        { type: 'Meeting', id: 'LIST' },
        { type: 'PlannerRow', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Removes the meeting and pulls its card out of the roster straight away.
     * The delete also unlinks any planner row that pointed at it (`SetNull`
     * server-side), so the grid's cache is busted the same way `updateMeeting`
     * busts it. */
    deleteMeeting: build.mutation<null, string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}`, method: 'DELETE' }),
      onQueryStarted: async (meetingId, { dispatch, queryFulfilled }) => {
        const listPatch = dispatch(
          toastlyApi.util.updateQueryData('getMeetings', undefined, (draft) =>
            draft.filter((entry) => entry.id !== meetingId),
          ),
        );
        try {
          await queryFulfilled;
          dispatch(toastlyApi.util.invalidateTags([{ type: 'Meeting', id: meetingId }]));
        } catch {
          listPatch.undo();
        }
      },
      invalidatesTags: [
        { type: 'Meeting', id: 'LIST' },
        { type: 'PlannerRow', id: 'LIST' },
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

    /* The only creation path for a guest — every other guest-linking flow
     * (meeting attendance, role/speaker pickers) selects an existing one. */
    createGuest: build.mutation<Guest, CreateGuestInput>({
      query: (body) => ({ url: '/guests', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Guest', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* The club's standing guest self-signup link behind the "Invite guest"
     * button — one token per club, minted lazily server-side on first read. */
    getGuestInviteLink: build.query<GuestInviteLink, void>({
      query: () => ({ url: '/guests/invite-link', method: 'GET' }),
    }),

    /* Rotation swaps the stored token (every previously shared QR/link dies).
     * The open dialog's cached link is patched in place from the response so
     * the fresh QR renders without a refetch spinner; a rejection just keeps
     * the old one and the call site toasts. */
    rotateGuestInviteLink: build.mutation<GuestInviteLink, void>({
      query: () => ({ url: '/guests/invite-link/rotate', method: 'POST' }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(toastlyApi.util.updateQueryData('getGuestInviteLink', undefined, () => data));
        } catch {
          /* handled at the call site */
        }
      },
    }),

    /* Anonymous preview for the public `/guest-invite/:token` page — matched
     * by `isPublicUrl` in `routed-base-query.ts`, so no `Authorization` header
     * goes out. Just resolves the token to a club name (or 404s). */
    getPublicGuestInvite: build.query<PublicGuestInvitePreview, string>({
      query: (token) => ({ url: `/public/guest-invites/${token}`, method: 'GET' }),
    }),

    /* Anonymous self-signup submit. Not tagged/invalidated: the submitter has
     * no cache entry of their own to refresh, and the officers' guest list
     * refetches on its own schedule — same reasoning as
     * `submitPublicEvaluation`. */
    submitPublicGuestInvite: build.mutation<
      { id: string },
      { token: string } & SubmitGuestInviteInput
    >({
      query: ({ token, ...body }) => ({
        url: `/public/guest-invites/${token}`,
        method: 'POST',
        body,
      }),
    }),

    /* Read-only preview for the convert-to-member dialog — tells it whether
     * the guest's phone matches an existing account before the admin
     * commits to anything. */
    checkGuestMatch: build.query<GuestMatch, string>({
      query: (guestId) => ({ url: `/guests/${guestId}/match`, method: 'GET' }),
      providesTags: (_match, _error, guestId) => [{ type: 'Guest', id: guestId }],
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

    /* Planner ideas come back as a flat list for the whole visible calendar
     * grid — a month's worth is small, and the day-cell markers need every
     * day in the range at once, so paging would only add round-trips. Each
     * (from, to) window is its own cache entry; mutations invalidate the
     * LIST tag so every loaded month refetches. */
    listPlannerIdeas: build.query<PlannerIdea[], { from: string; to: string }>({
      query: ({ from, to }) => {
        const params = new URLSearchParams({ from, to });
        return { url: `/planner/ideas?${params.toString()}`, method: 'GET' };
      },
      providesTags: (ideas) => [
        { type: 'PlannerIdea' as const, id: 'LIST' },
        ...(ideas ?? []).map((idea) => ({ type: 'PlannerIdea' as const, id: idea.id })),
      ],
    }),

    createPlannerIdea: build.mutation<PlannerIdea, CreatePlannerIdeaInput>({
      query: (body) => ({ url: '/planner/ideas', method: 'POST', body }),
      invalidatesTags: [
        { type: 'PlannerIdea', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Optimistic across every cached month window: the status dropdown should
     * settle in the same beat it is clicked, and a failed write rolls the
     * pill back rather than leaving the UI ahead of the database. */
    updatePlannerIdea: build.mutation<PlannerIdea, { ideaId: string } & UpdatePlannerIdeaInput>({
      query: ({ ideaId, ...body }) => ({
        url: `/planner/ideas/${ideaId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ ideaId, ...changes }, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'PlannerIdea', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listPlannerIdeas')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listPlannerIdeas',
                entry.originalArgs as { from: string; to: string },
                (draft) => {
                  const idea = draft.find((item) => item.id === ideaId);
                  if (idea) Object.assign(idea, changes);
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
      invalidatesTags: (_idea, _error, { ideaId }) => [
        { type: 'PlannerIdea', id: ideaId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deletePlannerIdea: build.mutation<null, string>({
      query: (ideaId) => ({ url: `/planner/ideas/${ideaId}`, method: 'DELETE' }),
      onQueryStarted: async (ideaId, { dispatch, getState, queryFulfilled }) => {
        const affected = toastlyApi.util.selectInvalidatedBy(getState(), [
          { type: 'PlannerIdea', id: 'LIST' },
        ]);
        const patches = affected
          .filter((entry) => entry.endpointName === 'listPlannerIdeas')
          .map((entry) =>
            dispatch(
              toastlyApi.util.updateQueryData(
                'listPlannerIdeas',
                entry.originalArgs as { from: string; to: string },
                (draft) => draft.filter((idea) => idea.id !== ideaId),
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
        { type: 'PlannerIdea', id: 'LIST' },
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

    /* Role assignments — keyed by meeting, one row per role key that has
     * been touched. The Roles tab, Overview readiness card, and Agenda
     * preview all read this same cache entry. */
    getMeetingRoles: build.query<RoleAssignment[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/roles`, method: 'GET' }),
      providesTags: (_rows, _error, meetingId) => [
        { type: 'MeetingRoleAssignment', id: meetingId },
      ],
    }),

    setMeetingRole: build.mutation<
      RoleAssignment,
      { meetingId: string; roleKey: string; membershipId: string | null; guestId?: string | null }
    >({
      query: ({ meetingId, roleKey, membershipId, guestId }) => ({
        url: `/meetings/${meetingId}/roles/${roleKey}`,
        method: 'PUT',
        body: { membershipId, guestId },
      }),
      onQueryStarted: async (
        { meetingId, roleKey, membershipId, guestId },
        { dispatch, queryFulfilled },
      ) => {
        const resolvedGuestId = guestId ?? null;
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getMeetingRoles', meetingId, (draft) => {
            const entry = draft.find((row) => row.roleKey === roleKey);
            if (entry) {
              entry.membershipId = membershipId;
              entry.guestId = resolvedGuestId;
            } else {
              draft.push({ roleKey, membershipId, guestId: resolvedGuestId });
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      /* A role held by a guest is not carried onto the planner from this
       * endpoint alone — bust the grid's cache too so a linked row's mirrored
       * columns (see `syncPlannerRolesFromMeeting`) show up without a manual
       * refresh. */
      invalidatesTags: (_row, _error, { meetingId }) => [
        { type: 'MeetingRoleAssignment', id: meetingId },
        { type: 'PlannerRow', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Prepared Speakers — ordered 1–3, seeded/mirrored from the planner's
     * Speaker 1–3 columns server-side (see `planner-mirror.ts`). */
    getPreparedSpeakers: build.query<PreparedSpeakerWire[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/prepared-speakers`, method: 'GET' }),
      providesTags: (_rows, _error, meetingId) => [{ type: 'PreparedSpeaker', id: meetingId }],
    }),

    createPreparedSpeaker: build.mutation<PreparedSpeakerWire, { meetingId: string }>({
      query: ({ meetingId }) => ({
        url: `/meetings/${meetingId}/prepared-speakers`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: (_row, _error, { meetingId }) => [
        { type: 'PreparedSpeaker', id: meetingId },
        { type: 'PlannerRow', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updatePreparedSpeaker: build.mutation<
      PreparedSpeakerWire,
      { meetingId: string; speakerId: string } & UpdatePreparedSpeakerInput
    >({
      query: ({ meetingId, speakerId, ...body }) => ({
        url: `/meetings/${meetingId}/prepared-speakers/${speakerId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async (
        { meetingId, speakerId, ...changes },
        { dispatch, queryFulfilled },
      ) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getPreparedSpeakers', meetingId, (draft) => {
            const entry = draft.find((row) => row.id === speakerId);
            if (entry) Object.assign(entry, changes);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_row, _error, { meetingId }) => [
        { type: 'PreparedSpeaker', id: meetingId },
        { type: 'PlannerRow', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deletePreparedSpeaker: build.mutation<null, { meetingId: string; speakerId: string }>({
      query: ({ meetingId, speakerId }) => ({
        url: `/meetings/${meetingId}/prepared-speakers/${speakerId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ meetingId, speakerId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getPreparedSpeakers', meetingId, (draft) =>
            draft.filter((entry) => entry.id !== speakerId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_row, _error, { meetingId }) => [
        { type: 'PreparedSpeaker', id: meetingId },
        { type: 'PlannerRow', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Table Topics questions — the Add flow only calls `create` once the
     * draft has real text, so every row in the list is already persisted. */
    getTableTopics: build.query<TableTopicQuestion[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/table-topics`, method: 'GET' }),
      providesTags: (_items, _error, meetingId) => [{ type: 'TableTopicQuestion', id: meetingId }],
    }),

    createTableTopicQuestion: build.mutation<
      TableTopicQuestion,
      { meetingId: string } & CreateTableTopicQuestionInput
    >({
      query: ({ meetingId, ...body }) => ({
        url: `/meetings/${meetingId}/table-topics`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'TableTopicQuestion', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Toggling "asked" is the hot path during a meeting — optimistic so the
     * checkmark feels instant. */
    updateTableTopicQuestion: build.mutation<
      TableTopicQuestion,
      { meetingId: string; itemId: string } & UpdateTableTopicQuestionInput
    >({
      query: ({ meetingId, itemId, ...body }) => ({
        url: `/meetings/${meetingId}/table-topics/${itemId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ meetingId, itemId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getTableTopics', meetingId, (draft) => {
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
        { type: 'TableTopicQuestion', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteTableTopicQuestion: build.mutation<null, { meetingId: string; itemId: string }>({
      query: ({ meetingId, itemId }) => ({
        url: `/meetings/${meetingId}/table-topics/${itemId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ meetingId, itemId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getTableTopics', meetingId, (draft) =>
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
        { type: 'TableTopicQuestion', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Attendance — club-roster check-in and guest rows are separate lists so
     * toggling one member doesn't refetch the whole guest set. */
    getAttendanceMembers: build.query<MemberAttendance[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/attendance/members`, method: 'GET' }),
      providesTags: (_rows, _error, meetingId) => [{ type: 'MeetingAttendance', id: meetingId }],
    }),

    setAttendanceMember: build.mutation<
      MemberAttendance,
      { meetingId: string; membershipId: string; present: boolean }
    >({
      query: ({ meetingId, membershipId, present }) => ({
        url: `/meetings/${meetingId}/attendance/members/${membershipId}`,
        method: 'PUT',
        body: { present },
      }),
      onQueryStarted: async (
        { meetingId, membershipId, present },
        { dispatch, queryFulfilled },
      ) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getAttendanceMembers', meetingId, (draft) => {
            const entry = draft.find((row) => row.membershipId === membershipId);
            if (entry) entry.present = present;
            else draft.push({ membershipId, present });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_row, _error, { meetingId }) => [
        { type: 'MeetingAttendance', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    getAttendanceGuests: build.query<GuestAttendance[], string>({
      query: (meetingId) => ({ url: `/meetings/${meetingId}/attendance/guests`, method: 'GET' }),
      providesTags: (_rows, _error, meetingId) => [
        { type: 'MeetingGuestAttendance', id: meetingId },
      ],
    }),

    createAttendanceGuest: build.mutation<
      GuestAttendance,
      { meetingId: string } & CreateGuestAttendanceInput
    >({
      query: ({ meetingId, ...body }) => ({
        url: `/meetings/${meetingId}/attendance/guests`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'MeetingGuestAttendance', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    updateAttendanceGuest: build.mutation<
      GuestAttendance,
      { meetingId: string; guestId: string } & UpdateGuestAttendanceInput
    >({
      query: ({ meetingId, guestId, ...body }) => ({
        url: `/meetings/${meetingId}/attendance/guests/${guestId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ meetingId, guestId, ...changes }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getAttendanceGuests', meetingId, (draft) => {
            const entry = draft.find((row) => row.id === guestId);
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
        { type: 'MeetingGuestAttendance', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteAttendanceGuest: build.mutation<null, { meetingId: string; guestId: string }>({
      query: ({ meetingId, guestId }) => ({
        url: `/meetings/${meetingId}/attendance/guests/${guestId}`,
        method: 'DELETE',
      }),
      onQueryStarted: async ({ meetingId, guestId }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          toastlyApi.util.updateQueryData('getAttendanceGuests', meetingId, (draft) =>
            draft.filter((entry) => entry.id !== guestId),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_item, _error, { meetingId }) => [
        { type: 'MeetingGuestAttendance', id: meetingId },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* "Mark all" / "Clear" touch every roster member plus every guest in one
     * request — simplest to just refetch both lists on success rather than
     * hand-patch every row. */
    markAllAttendance: build.mutation<
      MarkAllAttendanceResult,
      { meetingId: string; present: boolean }
    >({
      query: ({ meetingId, present }) => ({
        url: `/meetings/${meetingId}/attendance/mark-all`,
        method: 'PUT',
        body: { present },
      }),
      invalidatesTags: (_result, _error, { meetingId }) => [
        { type: 'MeetingAttendance', id: meetingId },
        { type: 'MeetingGuestAttendance', id: meetingId },
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

    /* Club-wide list — the Tasks page. Every task the caller's club has,
     * mine-first grouping happens client-side (see `tasks-directory.tsx`). */
    getAllTasks: build.query<Task[], void>({
      query: () => ({ url: '/tasks', method: 'GET' }),
      providesTags: (tasks) => [
        { type: 'Task', id: 'LIST' },
        ...(tasks ?? []).map((task) => ({ type: 'Task' as const, id: task.id })),
      ],
    }),

    /* Kept for the "Me" dashboard/profile widget — tasks assigned to one
     * member specifically. */
    getTasks: build.query<Task[], string>({
      query: (memberId) => ({ url: `/members/${memberId}/tasks`, method: 'GET' }),
      providesTags: (tasks, _error, memberId) => [
        { type: 'Task', id: memberId },
        ...(tasks ?? []).map((task) => ({ type: 'Task' as const, id: task.id })),
      ],
    }),

    createTask: build.mutation<Task, CreateTaskInput>({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: (task) => [
        { type: 'Task', id: 'LIST' },
        // A brand-new task can't yet appear in any assignee's per-member
        // cache via its own tag, so their `memberId` tag is invalidated
        // directly instead.
        ...(task ? task.assignees.map((a) => ({ type: 'Task' as const, id: a.id })) : []),
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    /* Covers structural edits (title/description/priority/assignees), the
     * creator-or-assignee "mark done" toggle, and the "Me" widget's
     * checkbox — `memberId` is only passed by the latter, purely to drive
     * its optimistic patch so the toggle feels instant. */
    updateTask: build.mutation<Task, { taskId: string; memberId?: string } & UpdateTaskInput>({
      query: ({ taskId, memberId: _memberId, ...body }) => ({
        url: `/tasks/${taskId}`,
        method: 'PATCH',
        body,
      }),
      onQueryStarted: async ({ taskId, memberId, done }, { dispatch, queryFulfilled }) => {
        if (!memberId || done === undefined) return;
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
      invalidatesTags: (task, _error, { taskId, memberId }) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: 'LIST' },
        ...(memberId ? [{ type: 'Task' as const, id: memberId }] : []),
        ...(task ? task.assignees.map((a) => ({ type: 'Task' as const, id: a.id })) : []),
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    deleteTask: build.mutation<null, string>({
      query: (taskId) => ({ url: `/tasks/${taskId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, taskId) => [
        { type: 'Task', id: taskId },
        { type: 'Task', id: 'LIST' },
        { type: 'ActivityLog', id: 'LIST' },
      ],
    }),

    addTaskNote: build.mutation<Task, { taskId: string } & CreateTaskNoteInput>({
      query: ({ taskId, ...body }) => ({ url: `/tasks/${taskId}/notes`, method: 'POST', body }),
      invalidatesTags: (_task, _error, { taskId }) => [{ type: 'Task', id: taskId }],
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
    /* Self-service password rotation — see `AuthService.changePassword`.
     * The session slice's `mustChangePassword` flag is updated by the
     * caller on success, same as any other locally-derived session field. */
    changePassword: build.mutation<void, ChangePasswordInput>({
      query: (body) => ({ url: '/auth/password', method: 'PATCH', body }),
    }),
    /* Self-service profile — the signed-in account holder's own view of
     * themselves (bio/avatar/socials + a read-only pathway summary),
     * distinct from `listPlatformUsers` (the Super Admin's cross-tenant
     * view of everyone else). */
    getMyProfile: build.query<Profile, void>({
      query: () => ({ url: '/profile', method: 'GET' }),
      providesTags: ['Profile'],
    }),
    updateMyProfile: build.mutation<Profile, UpdateProfileInput>({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      invalidatesTags: ['Profile'],
    }),
    /* Anonymous credential handoff — same shape as `getPublicMeeting`:
     * matched by `isPublicUrl` in `routed-base-query.ts`, so no
     * `Authorization` header goes out. The row (and so this query) stops
     * resolving the moment the recipient actually logs in once. */
    getCredentialShare: build.query<CredentialShare, { userId: string; token: string }>({
      query: ({ userId, token }) => ({
        url: `/public/users/${userId}/credentials?t=${encodeURIComponent(token)}`,
        method: 'GET',
      }),
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

    /* Web Push — self-service, tied to the signed-in user rather than a
     * club context. No query/tag to invalidate: subscription state lives in
     * the browser's PushManager, not in any cached list this app renders. */
    subscribeToPush: build.mutation<void, PushSubscriptionInput & { userAgent?: string }>({
      query: (body) => ({ url: '/push/subscribe', method: 'POST', body }),
    }),

    unsubscribeFromPush: build.mutation<void, { endpoint: string }>({
      query: (body) => ({ url: '/push/unsubscribe', method: 'POST', body }),
    }),
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
  /** Signed, time-limited photo URL when the account has one. Read-only —
   * it expires, so it is never sent back on an update. */
  avatarUrl?: string;
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
  credentialShare: { token: string };
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** Wire shape from `GET /public/users/:userId/credentials?t=...` — the
 * unauthenticated handoff page's only data source. */
export interface CredentialShare {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
}

/** Wire shape from `GET /public/invites/:token` — what `/invite/:token`
 * shows before the visitor signs in or signs up. */
export interface InvitePreview {
  state: 'valid' | 'expired' | 'accepted' | 'revoked';
  clubName: string;
  roles: OfficerRole[];
}

/** Response from `POST /invites/:token/accept` — enough for the accept page
 * to switch context and redirect into the new club's dashboard. */
export interface AcceptedInvite {
  clubId: string;
  clubName: string;
}

/** Wire shape from `GET /clubs/directory` — the public browse list a
 * clubless user picks through on the onboarding screen. Lineage fields are
 * absent for a still-unplaced, self-registered club. */
export interface PublicClub {
  id: string;
  slug: string;
  name: string;
  clubNumber?: string;
  areaName?: string;
  divisionName?: string;
  districtName?: string;
}

/** Response from `POST /clubs/join-by-code` — mirrors `AcceptedInvite`, same
 * "enough to switch context and redirect" shape. */
export interface JoinedClub {
  clubId: string;
  clubName: string;
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
  useLazyGetMembersQuery,
  useGetMemberQuery,
  useGetMemberHistoryQuery,
  useGetMemberStatsQuery,
  useGetPlannerRowsQuery,
  useCreatePlannerRowMutation,
  useUpdatePlannerRowMutation,
  useDeletePlannerRowMutation,
  useStartPathwayMutation,
  useCreateMemberMutation,
  useBulkCreateMembersMutation,
  useUpdateMemberMutation,
  useSetMemberStatusMutation,
  useSetMemberAdminMutation,
  useSetMemberPermissionsMutation,
  useGetMeetingsQuery,
  useGetMeetingQuery,
  useGetPublicMeetingQuery,
  useGetPublicSpeakerQuery,
  useGetPublicRoleAssignmentQuery,
  useGetPublicAgendaSpeakerSourcesQuery,
  useGetPublicMeetingAgendaQuery,
  useSignPublicEvaluationUploadMutation,
  useSubmitPublicEvaluationMutation,
  useGetReceivedEvaluationsQuery,
  useCreateMeetingMutation,
  useUpdateMeetingMutation,
  useDeleteMeetingMutation,
  useGetGuestsQuery,
  useLazyGetGuestsQuery,
  useGetGuestQuery,
  useCreateGuestMutation,
  useGetGuestInviteLinkQuery,
  useRotateGuestInviteLinkMutation,
  useGetPublicGuestInviteQuery,
  useSubmitPublicGuestInviteMutation,
  useCheckGuestMatchQuery,
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
  useListPlannerIdeasQuery,
  useCreatePlannerIdeaMutation,
  useUpdatePlannerIdeaMutation,
  useDeletePlannerIdeaMutation,
  useGetChecklistQuery,
  useCreateChecklistItemMutation,
  useUpdateChecklistItemMutation,
  useDeleteChecklistItemMutation,
  useGetMeetingRolesQuery,
  useLazyGetMeetingRolesQuery,
  useSetMeetingRoleMutation,
  useGetPreparedSpeakersQuery,
  useCreatePreparedSpeakerMutation,
  useUpdatePreparedSpeakerMutation,
  useDeletePreparedSpeakerMutation,
  useGetTableTopicsQuery,
  useCreateTableTopicQuestionMutation,
  useUpdateTableTopicQuestionMutation,
  useDeleteTableTopicQuestionMutation,
  useGetAttendanceMembersQuery,
  useSetAttendanceMemberMutation,
  useGetAttendanceGuestsQuery,
  useCreateAttendanceGuestMutation,
  useUpdateAttendanceGuestMutation,
  useDeleteAttendanceGuestMutation,
  useMarkAllAttendanceMutation,
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
  useGetAllTasksQuery,
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useAddTaskNoteMutation,
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
  useGetPublicInvitePreviewQuery,
  useAcceptInviteMutation,
  useGetPublicClubDirectoryQuery,
  useGetClubJoinCodeQuery,
  useGetClubProfileQuery,
  useLazyGetClubProfileQuery,
  useUpdateClubProfileMutation,
  useJoinClubByCodeMutation,
  useAuthLoginMutation,
  useAuthRegisterMutation,
  useAuthLogoutMutation,
  useGetAuthSessionQuery,
  useLazyGetAuthSessionQuery,
  useChangePasswordMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  useGetCredentialShareQuery,
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
  useSubscribeToPushMutation,
  useUnsubscribeFromPushMutation,
} = toastlyApi;
