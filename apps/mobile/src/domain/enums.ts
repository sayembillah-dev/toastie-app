/**
 * Enumerations mirrored from the API's Prisma schema.
 *
 * Source of truth: `apps/api/prisma/schema.prisma` (documented in docs/ERD.md section 3).
 * These are string-identical to the server enums on purpose — the same discipline
 * as the API's own `roles.compat.ts` drift check. If a value here stops matching
 * the server, requests fail as unexplained 403s or 400s rather than at build time,
 * so treat any edit here as a schema change, not a cosmetic one.
 */

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CLUB_DIRECTORY_STATUSES = ['active', 'low', 'suspended'] as const;
export type ClubDirectoryStatus = (typeof CLUB_DIRECTORY_STATUSES)[number];

export const CLUB_LIFECYCLES = ['active', 'inactive', 'chartered'] as const;
export type ClubLifecycle = (typeof CLUB_LIFECYCLES)[number];

export const CLUB_JOIN_POLICIES = ['request', 'closed', 'open'] as const;
export type ClubJoinPolicy = (typeof CLUB_JOIN_POLICIES)[number];

export const MEMBERSHIP_STATUSES = ['active', 'removed'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const MEMBER_TYPES = ['new', 'existing'] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export type { ClubRole, OrgRole, OrgUnitType } from '@toastly/access';
/**
 * Roles live in `@toastly/access`, not here.
 *
 * They are re-exported so callers have one import site, but the definition is
 * the workspace package the API and the web app compile against — there is no
 * second copy to drift. That is why roles get this treatment and the enums
 * above do not: the access package is shared code, the Prisma enums are not.
 */
export {
  CLUB_ROLES,
  isClubRole,
  isOrgRole,
  ORG_ROLES,
  ORG_UNIT_TYPES,
} from '@toastly/access';

export const INVITE_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'declined', 'withdrawn'] as const;
export type JoinRequestStatus = (typeof JOIN_REQUEST_STATUSES)[number];

export const MEETING_STATUSES = ['draft', 'published'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const HISTORY_EVENT_TYPES = [
  'joined',
  'levelReached',
  'speechGiven',
  'projectStarted',
  'projectCompleted',
  'roleTaken',
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export const SPEECH_SLOT_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;
export type SpeechSlotRequestStatus = (typeof SPEECH_SLOT_REQUEST_STATUSES)[number];

export const PLANNER_IDEA_STATUSES = ['created', 'drafted', 'published'] as const;
export type PlannerIdeaStatus = (typeof PLANNER_IDEA_STATUSES)[number];

export const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * Guest pipeline stages (ERD section 4.7, `Prospect.stage`). Ordered as the
 * kanban board reads left to right; `not-interested` is terminal, not a stage
 * the pipeline advances through.
 */
export const PROSPECT_STAGES = [
  'new',
  'contacted',
  'interested',
  'joined-meetings',
  'joined-club',
  'not-interested',
] as const;
export type ProspectStage = (typeof PROSPECT_STAGES)[number];
