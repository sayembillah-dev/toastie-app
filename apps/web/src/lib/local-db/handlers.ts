import type { ActivityCategory, ActivityLog } from '@/lib/activity/activity-log';
import { sortActivityLogsNewestFirst } from '@/lib/activity/activity-log';
import type { CreateInviteInput, Invite } from '@/lib/club-admin/invites';
import type { Evaluation } from '@/lib/education/evaluations';
import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import { computeMemberStats, sortEvents } from '@/lib/education/history';
import type {
  CreateMemberInput,
  Member,
  OfficerRole,
  StartPathwayInput,
  UpdateMemberInput,
} from '@/lib/education/members';
import { OFFICER_ROLES, PATHWAYS } from '@/lib/education/members';
import { findProject } from '@/lib/education/pathways';
import type {
  CreateSpeechSlotRequestInput,
  SpeechSlotRequest,
} from '@/lib/education/speech-slot-requests';
import { SPEECH_SLOT_REQUEST_NOTE_MAX } from '@/lib/education/speech-slot-requests';
import type {
  BudgetLine,
  CreateBudgetLineInput,
  UpdateBudgetLineInput,
} from '@/lib/finance/budget';
import { BUDGET_LINE_NOTE_MAX } from '@/lib/finance/budget';
import type { DuesRecord, UpdateDuesRecordInput } from '@/lib/finance/dues';
import { getDuesPeriod } from '@/lib/finance/dues';
import type {
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from '@/lib/finance/transactions';
import {
  CATEGORY_LABELS,
  isIncomeCategory,
  isPaymentMethod,
  isTransactionCategory,
  sortTransactionsNewestFirst,
  TRANSACTION_COUNTERPARTY_MAX,
  TRANSACTION_DESCRIPTION_MAX,
  TRANSACTION_REFERENCE_MAX,
} from '@/lib/finance/transactions';
import type {
  ChecklistItem,
  CreateChecklistItemInput,
  UpdateChecklistItemInput,
} from '@/lib/inventory/checklist';
import { CHECKLIST_ITEM_TEXT_MAX, DEFAULT_CHECKLIST_TEXTS } from '@/lib/inventory/checklist';
import type {
  CreateInventoryItemInput,
  InventoryItem,
  UpdateInventoryItemInput,
} from '@/lib/inventory/inventory-items';
import {
  INVENTORY_DESCRIPTION_MAX,
  INVENTORY_IMAGE_MAX_BYTES,
  INVENTORY_TITLE_MAX,
  isInventoryImageMimeType,
  sortInventoryItemsNewestFirst,
} from '@/lib/inventory/inventory-items';
import type { Asset, AssetsPage, CreateAssetInput, UpdateAssetInput } from '@/lib/library/assets';
import {
  ASSET_FILE_MAX_BYTES,
  ASSET_TITLE_MAX,
  ASSETS_PAGE_SIZE,
  isAssetMimeType,
  matchesAssetQuery,
  sortAssetsNewestFirst,
} from '@/lib/library/assets';
import type {
  CreateDocumentInput,
  DocumentsPage,
  LibraryDocument,
  UpdateDocumentInput,
} from '@/lib/library/documents';
import {
  DOCUMENT_FILE_MAX_BYTES,
  DOCUMENT_TITLE_MAX,
  DOCUMENTS_PAGE_SIZE,
  isDocumentMimeType,
  matchesDocumentQuery,
  sortDocumentsNewestFirst,
} from '@/lib/library/documents';
import { CURRENT_MEMBER_ID } from '@/lib/me/current-member';
import type { AhCounterEntry } from '@/lib/meetings/ah-counter-reports';
import type { CreateMeetingInput, Meeting, UpdateMeetingInput } from '@/lib/meetings/meetings';
import { MEETING_STATUSES } from '@/lib/meetings/meetings';
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
import { CLUB_NUMBER_MAX, DISTRICT_CODE_MAX, isOrgClubStatus, ORG_NAME_MAX } from '@/lib/org/types';
import type {
  ContactLog,
  CreateContactLogInput,
  UpdateContactLogInput,
} from '@/lib/people/contact-logs';
import { CONTACT_LOG_OUTCOME_MAX, isContactMethod } from '@/lib/people/contact-logs';
import type { Guest, GuestSocial, UpdateGuestInput } from '@/lib/people/guests';
import { isGuestStage, isSocialPlatform } from '@/lib/people/guests';
import type { CreateVisitLogInput, UpdateVisitLogInput, VisitLog } from '@/lib/people/visit-logs';
import { VISIT_LOG_NOTES_MAX, VISIT_LOG_ROLE_MAX } from '@/lib/people/visit-logs';
import type { ModuleKey, ModulePermission } from '@/lib/permissions/permissions';
import { getEffectivePermission, MODULES } from '@/lib/permissions/permissions';
import type { Task, UpdateTaskInput } from '@/lib/tasks/tasks';

import {
  readActivityLogs,
  readAhCounterEntries,
  readAreas,
  readAssets,
  readBudgetLines,
  readChecklists,
  readContactLogs,
  readDistricts,
  readDivisions,
  readDocuments,
  readDuesRecords,
  readEvaluations,
  readExtrasFor,
  readGuests,
  readHistoryEvents,
  readInventoryItems,
  readInvites,
  readMeetings,
  readMembers,
  readOrgClubs,
  readSpeechSlotRequests,
  readTasks,
  readTimerEntries,
  readTransactions,
  readVisitLogs,
  writeActivityLogs,
  writeAreas,
  writeAssets,
  writeBudgetLines,
  writeChecklists,
  writeContactLogs,
  writeDistricts,
  writeDivisions,
  writeDocuments,
  writeDuesRecords,
  writeGuests,
  writeHistoryEvents,
  writeInventoryItems,
  writeInvites,
  writeMeetings,
  writeMembers,
  writeOrgClubs,
  writeSpeechSlotRequests,
  writeTasks,
  writeTransactions,
  writeVisitLogs,
} from './db';

/**
 * A miniature REST server over the localStorage tables. The routes below are
 * the exact contract the Nest API will implement, which is the point of the
 * exercise: the RTK Query endpoints are written against real URLs, methods and
 * status codes, so swapping `localBaseQuery` for `fetchBaseQuery` is the whole
 * migration.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface LocalRequest {
  url: string;
  method?: HttpMethod;
  body?: unknown;
}

/** Mirrors the `{ status, data }` shape `fetchBaseQuery` rejects with, so error
 * handling in components survives the swap unchanged. */
export class LocalApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LocalApiError';
  }
}

interface RouteContext {
  params: Record<string, string>;
  /** Parsed `?key=value` pairs off the URL. Empty when the request had none. */
  query: Record<string, string>;
  body: unknown;
}

type RouteHandler = (context: RouteContext) => unknown;

/* --------------------------------------------------------------- helpers -- */

function requireMember(memberId: string): Member {
  const member = readMembers().find((entry) => entry.id === memberId);
  if (!member) throw new LocalApiError(404, `No member with id "${memberId}"`);
  return member;
}

function eventsForMember(memberId: string): HistoryEvent[] {
  return readHistoryEvents().filter((event) => event.memberId === memberId);
}

/** New ids sort above the seeded `-e1`/`-r1` ids under the timeline's
 * descending tie-break, so an event added today leads the day it lands on. */
function createEventId(memberId: string): string {
  return `${memberId}-z${Date.now().toString(36)}`;
}

function createActivityLogId(): string {
  return `act-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Appends one row to the activity feed. Called from the tail of every
 * mutating handler below — there is no auth yet, so every entry is
 * attributed to `CURRENT_MEMBER_ID`, same stand-in the rest of the app uses. */
function recordActivity(entry: {
  category: ActivityCategory;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
}): void {
  const log: ActivityLog = {
    ...entry,
    id: createActivityLogId(),
    actorMemberId: CURRENT_MEMBER_ID,
    points: 0,
    createdAt: new Date().toISOString(),
  };
  writeActivityLogs([log, ...readActivityLogs()]);
}

/** Stands in for the Nest ValidationPipe: the body has to name a real pathway
 * and a real project, and the level has to be the one that project belongs to. */
function parseStartPathwayBody(body: unknown): StartPathwayInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a start-pathway body');
  }

  const { pathway, project, level } = body as Partial<StartPathwayInput>;

  if (!pathway || !PATHWAYS.includes(pathway)) {
    throw new LocalApiError(400, `"${String(pathway)}" is not a Toastmasters pathway`);
  }

  const definition = project ? findProject(project, pathway) : undefined;
  if (!definition) {
    throw new LocalApiError(400, `"${String(project)}" is not a project in the catalog`);
  }
  if (level !== definition.level) {
    throw new LocalApiError(400, `"${definition.name}" is a level ${definition.level} project`);
  }

  return { pathway, project: definition.name, level: definition.level };
}

/** The create-meeting equivalent of the ValidationPipe above. The 409 on a
 * duplicate number is the one rule the form cannot enforce on its own — two
 * tabs open on the roster would both offer the same "next" number. */
function parseCreateMeetingBody(body: unknown): CreateMeetingInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-meeting body');
  }

  const { meetingNumber, dateTime, theme } = body as Partial<CreateMeetingInput>;

  if (typeof meetingNumber !== 'number' || !Number.isInteger(meetingNumber) || meetingNumber < 1) {
    throw new LocalApiError(400, 'The meeting number must be a whole number above zero');
  }
  if (readMeetings().some((meeting) => meeting.meetingNumber === meetingNumber)) {
    throw new LocalApiError(409, `Meeting #${meetingNumber} already exists`);
  }
  if (typeof dateTime !== 'string' || Number.isNaN(new Date(dateTime).getTime())) {
    throw new LocalApiError(400, 'A valid meeting date and time is required');
  }
  if (typeof theme !== 'string' || theme.trim() === '') {
    throw new LocalApiError(400, 'A theme is required');
  }

  return { meetingNumber, dateTime, theme: theme.trim() };
}

/** Validates a Save as Draft / Publish commit. `theme` is optional because the
 * meeting page only sends it once the Theme tab has been filled in — an absent
 * field leaves the stored theme alone rather than blanking it. */
function parseUpdateMeetingBody(body: unknown): UpdateMeetingInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-meeting body');
  }

  const { status, theme } = body as Partial<UpdateMeetingInput>;

  if (!status || !MEETING_STATUSES.includes(status)) {
    throw new LocalApiError(400, `"${String(status)}" is not a meeting status`);
  }
  if (theme !== undefined && (typeof theme !== 'string' || theme.trim() === '')) {
    throw new LocalApiError(400, 'A theme cannot be blank');
  }

  return theme === undefined ? { status } : { status, theme: theme.trim() };
}

/** String fields on the guest that the edit panel writes. Kept as a plain
 * whitelist so validation stays a single map/filter and every unknown key on
 * the body is dropped rather than persisted. */
const EDITABLE_STRING_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'whatsapp',
  'avatarUrl',
  'bio',
  'notes',
] as const;

type EditableStringField = (typeof EDITABLE_STRING_FIELDS)[number];

function parseSocials(input: unknown): GuestSocial[] {
  if (!Array.isArray(input)) throw new LocalApiError(400, 'socials must be an array');
  return input.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new LocalApiError(400, `socials[${index}] is not an object`);
    }
    const { platform, url } = entry as { platform?: unknown; url?: unknown };
    if (!isSocialPlatform(platform)) {
      throw new LocalApiError(400, `socials[${index}].platform "${String(platform)}" is unknown`);
    }
    if (typeof url !== 'string' || url.trim() === '') {
      throw new LocalApiError(400, `socials[${index}].url is required`);
    }
    return { platform, url: url.trim() };
  });
}

/** Validates any subset of the edit panel's fields — the panel Patches only
 * what changed, and the kanban keeps sending just `stage`. Empty strings on
 * optional fields are normalised to `undefined` so a cleared input clears the
 * record rather than storing `""`. */
function parseUpdateGuestBody(body: unknown): UpdateGuestInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-guest body');
  }

  const input = body as Record<string, unknown>;
  const output: UpdateGuestInput = {};

  for (const field of EDITABLE_STRING_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];
    if (raw === undefined || raw === null || raw === '') {
      output[field as EditableStringField] = undefined;
      continue;
    }
    if (typeof raw !== 'string') {
      throw new LocalApiError(400, `${field} must be a string`);
    }
    const trimmed = raw.trim();
    output[field as EditableStringField] = trimmed === '' ? undefined : trimmed;
  }

  if ('socials' in input) {
    output.socials = input.socials === undefined ? undefined : parseSocials(input.socials);
  }

  if ('stage' in input) {
    if (!isGuestStage(input.stage)) {
      throw new LocalApiError(400, `"${String(input.stage)}" is not a guest stage`);
    }
    output.stage = input.stage;
  }

  if (output.firstName === undefined && 'firstName' in input) {
    throw new LocalApiError(400, 'firstName cannot be blank');
  }
  if (output.lastName === undefined && 'lastName' in input) {
    throw new LocalApiError(400, 'lastName cannot be blank');
  }

  return output;
}

/* ---------------------------------------------------------------- routes -- */

/** Removed members are hidden from the normal roster by default — the
 * directory, attendance picker, dues list, etc. — so a soft-removed member
 * stops showing up anywhere operational without losing their history. The
 * Club Admin dashboard and the Activity Logs actor lookup (a past action can
 * reference a since-removed member) pass `?includeRemoved=true` to see
 * everyone. */
function listMembers({ query }: RouteContext): Member[] {
  const members = readMembers();
  return query.includeRemoved === 'true'
    ? members
    : members.filter((member) => member.status !== 'removed');
}

function getMember({ params }: RouteContext): Member {
  return requireMember(params.memberId);
}

function getMemberHistory({ params }: RouteContext): HistoryEvent[] {
  requireMember(params.memberId);
  return sortEvents(eventsForMember(params.memberId));
}

function getMemberStats({ params }: RouteContext): MemberStats {
  const member = requireMember(params.memberId);
  return computeMemberStats(eventsForMember(member.id), readExtrasFor(member.id));
}

/** Sets the member's active pathway and records the matching `project-started`
 * event, so Progress and History both move on a single write. `startingLevel`
 * snapshots where the journey began on this platform — a member migrating in at
 * level 3 keeps that anchor after their current level moves on. */
function startPathway({ params, body }: RouteContext): Member {
  const input = parseStartPathwayBody(body);
  const member = requireMember(params.memberId);
  const today = new Date().toISOString().slice(0, 10);

  const updated: Member = {
    ...member,
    pathway: input.pathway,
    level: input.level,
    startingLevel: input.level,
    startedProject: input.project,
    pathwayStartedAt: today,
  };
  writeMembers(readMembers().map((entry) => (entry.id === member.id ? updated : entry)));

  const startedEvent: HistoryEvent = {
    id: createEventId(member.id),
    memberId: member.id,
    type: 'project-started',
    date: today,
    projectName: input.project,
    level: input.level,
    pathway: input.pathway,
  };
  writeHistoryEvents([...readHistoryEvents(), startedEvent]);

  recordActivity({
    category: 'education',
    action: 'started a pathway',
    summary: `Started the ${input.pathway} pathway at Level ${input.level}`,
    entityType: 'member',
    entityId: member.id,
  });

  return updated;
}

/* ------------------------------------------------------------- club admin -- */

function isOfficerRole(value: unknown): value is OfficerRole {
  return typeof value === 'string' && (OFFICER_ROLES as readonly string[]).includes(value);
}

function parseRoles(input: unknown, fieldName = 'roles'): OfficerRole[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new LocalApiError(400, `${fieldName} must be a non-empty array of officer roles`);
  }
  return input.map((role) => {
    if (!isOfficerRole(role))
      throw new LocalApiError(400, `"${String(role)}" is not an officer role`);
    return role;
  });
}

function createMemberId(): string {
  return `m-${Date.now().toString(36)}`;
}

function parseCreateMemberBody(body: unknown): CreateMemberInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-member body');
  }
  const { firstName, lastName, roles } = body as Partial<CreateMemberInput>;
  if (typeof firstName !== 'string' || firstName.trim() === '') {
    throw new LocalApiError(400, 'firstName is required');
  }
  if (typeof lastName !== 'string' || lastName.trim() === '') {
    throw new LocalApiError(400, 'lastName is required');
  }
  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    roles: roles === undefined ? undefined : parseRoles(roles),
  };
}

/** Powers the Club Admin "Add member" form. `roles` falls back to plain
 * Member when the form leaves it empty. */
function createMember({ body }: RouteContext): Member {
  const input = parseCreateMemberBody(body);
  const member: Member = {
    id: createMemberId(),
    firstName: input.firstName,
    lastName: input.lastName,
    roles: input.roles && input.roles.length > 0 ? input.roles : ['Member'],
    isClubAdmin: false,
    status: 'active',
  };
  writeMembers([...readMembers(), member]);
  recordActivity({
    category: 'people',
    action: 'added a member',
    summary: `Added ${member.firstName} ${member.lastName} to the roster`,
    entityType: 'member',
    entityId: member.id,
  });
  return member;
}

function parseUpdateMemberBody(body: unknown): UpdateMemberInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-member body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateMemberInput = {};

  if ('firstName' in input) {
    if (typeof input.firstName !== 'string' || input.firstName.trim() === '') {
      throw new LocalApiError(400, 'firstName cannot be blank');
    }
    output.firstName = input.firstName.trim();
  }
  if ('lastName' in input) {
    if (typeof input.lastName !== 'string' || input.lastName.trim() === '') {
      throw new LocalApiError(400, 'lastName cannot be blank');
    }
    output.lastName = input.lastName.trim();
  }
  if ('roles' in input) {
    output.roles = parseRoles(input.roles);
  }
  return output;
}

/** Plain profile/role editing — status, admin flag and permissions each have
 * their own dedicated endpoint below since they carry their own guard rules. */
function updateMember({ params, body }: RouteContext): Member {
  const existing = requireMember(params.memberId);
  const updated: Member = { ...existing, ...parseUpdateMemberBody(body) };
  writeMembers(readMembers().map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'updated a member',
    summary: `Updated ${updated.firstName} ${updated.lastName}'s profile`,
    entityType: 'member',
    entityId: updated.id,
  });
  return updated;
}

/** True when `member` is the club's only active Club Admin — the guard both
 * `setMemberStatus` (removing them) and `setMemberAdmin` (demoting them) use
 * to keep the club from locking itself out of its own admin dashboard. */
function isLastActiveClubAdmin(member: Member): boolean {
  if (!member.isClubAdmin || member.status !== 'active') return false;
  const activeAdmins = readMembers().filter(
    (entry) => entry.isClubAdmin && entry.status === 'active',
  );
  return activeAdmins.length <= 1;
}

function parseSetMemberStatusBody(body: unknown): { status: Member['status'] } {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a status body');
  }
  const { status } = body as { status?: unknown };
  if (status !== 'active' && status !== 'removed') {
    throw new LocalApiError(400, `"${String(status)}" is not a member status`);
  }
  return { status };
}

/** Soft remove/restore — the record and its history (speeches, evaluations,
 * activity log) stay put, the member just drops out of the active roster. */
function setMemberStatus({ params, body }: RouteContext): Member {
  const existing = requireMember(params.memberId);
  const { status } = parseSetMemberStatusBody(body);

  if (status === 'removed' && isLastActiveClubAdmin(existing)) {
    throw new LocalApiError(
      400,
      'The club must keep at least one active Club Admin — promote someone else first.',
    );
  }

  const updated: Member = { ...existing, status };
  writeMembers(readMembers().map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: status === 'removed' ? 'removed a member' : 'restored a member',
    summary: `${status === 'removed' ? 'Removed' : 'Restored'} ${updated.firstName} ${updated.lastName}`,
    entityType: 'member',
    entityId: updated.id,
  });
  return updated;
}

function parseSetMemberAdminBody(body: unknown): { isClubAdmin: boolean } {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an admin body');
  }
  const { isClubAdmin } = body as { isClubAdmin?: unknown };
  if (typeof isClubAdmin !== 'boolean') {
    throw new LocalApiError(400, 'isClubAdmin must be a boolean');
  }
  return { isClubAdmin };
}

/** Grants or revokes full read/mutate access to every module. Any Club Admin
 * can promote or demote another — including themselves, as long as it
 * doesn't leave the club with zero active admins. */
function setMemberAdmin({ params, body }: RouteContext): Member {
  const existing = requireMember(params.memberId);
  const { isClubAdmin } = parseSetMemberAdminBody(body);

  if (!isClubAdmin && isLastActiveClubAdmin(existing)) {
    throw new LocalApiError(
      400,
      'The club must keep at least one Club Admin — promote someone else before revoking the last one.',
    );
  }

  const updated: Member = { ...existing, isClubAdmin };
  writeMembers(readMembers().map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: isClubAdmin ? 'granted club admin' : 'revoked club admin',
    summary: isClubAdmin
      ? `Made ${updated.firstName} ${updated.lastName} a Club Admin`
      : `Removed ${updated.firstName} ${updated.lastName} as a Club Admin`,
    entityType: 'member',
    entityId: updated.id,
  });
  return updated;
}

function isModuleKey(value: string): value is ModuleKey {
  return (MODULES as readonly string[]).includes(value);
}

function parseModulePermission(value: unknown, key: string): ModulePermission {
  if (typeof value !== 'object' || value === null) {
    throw new LocalApiError(400, `${key} must be an object`);
  }
  const { read, mutate } = value as { read?: unknown; mutate?: unknown };
  if (typeof read !== 'boolean' || typeof mutate !== 'boolean') {
    throw new LocalApiError(400, `${key}.read and ${key}.mutate must be booleans`);
  }
  return { read, mutate };
}

function parseSetMemberPermissionsBody(
  body: unknown,
): Partial<Record<ModuleKey, ModulePermission>> {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a permissions body');
  }
  const output: Partial<Record<ModuleKey, ModulePermission>> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!isModuleKey(key)) throw new LocalApiError(400, `"${key}" is not a module`);
    output[key] = parseModulePermission(value, key);
  }
  return output;
}

/** Merges a partial module → { read, mutate } map into the member's
 * overrides — modules not present in the body are left exactly as they
 * were, matching the PATCH semantics used everywhere else. */
function setMemberPermissions({ params, body }: RouteContext): Member {
  const existing = requireMember(params.memberId);
  const overrides = parseSetMemberPermissionsBody(body);
  const updated: Member = {
    ...existing,
    permissions: { ...existing.permissions, ...overrides },
  };
  writeMembers(readMembers().map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'updated permissions',
    summary: `Updated module permissions for ${updated.firstName} ${updated.lastName}`,
    entityType: 'member',
    entityId: updated.id,
  });
  return updated;
}

function createInviteId(): string {
  return `inv-${Date.now().toString(36)}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCreateInviteBody(body: unknown): CreateInviteInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-invite body');
  }
  const { email, firstName, lastName, roles } = body as Partial<CreateInviteInput>;
  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    throw new LocalApiError(400, 'A valid email is required');
  }
  return {
    email: email.trim(),
    firstName:
      typeof firstName === 'string' && firstName.trim() !== '' ? firstName.trim() : undefined,
    lastName: typeof lastName === 'string' && lastName.trim() !== '' ? lastName.trim() : undefined,
    /* Roles are optional on an invite — an absent field and an empty
     * selection both mean "no roles picked yet", not "invalid input". */
    roles: Array.isArray(roles) && roles.length > 0 ? parseRoles(roles) : [],
  };
}

function listInvites(): Invite[] {
  return readInvites();
}

/** No email is actually sent — there's no email infrastructure in this app.
 * The invite is a trackable pending record a Club Admin can revoke, or
 * convert into a real member by hand once the person actually joins. */
function createInvite({ body }: RouteContext): Invite {
  const input = parseCreateInviteBody(body);
  const invite: Invite = {
    id: createInviteId(),
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    roles: input.roles,
    status: 'pending',
    invitedBy: CURRENT_MEMBER_ID,
    invitedAt: new Date().toISOString(),
  };
  writeInvites([invite, ...readInvites()]);
  recordActivity({
    category: 'people',
    action: 'invited a member',
    summary: `Invited ${invite.email} to join the club`,
    entityType: 'invite',
    entityId: invite.id,
  });
  return invite;
}

function requireInvite(inviteId: string): Invite {
  const invite = readInvites().find((entry) => entry.id === inviteId);
  if (!invite) throw new LocalApiError(404, `No invite with id "${inviteId}"`);
  return invite;
}

function revokeInvite({ params }: RouteContext): Invite {
  const invite = requireInvite(params.inviteId);
  if (invite.status !== 'pending') {
    throw new LocalApiError(400, 'Only a pending invite can be revoked');
  }
  const updated: Invite = { ...invite, status: 'revoked', respondedAt: new Date().toISOString() };
  writeInvites(readInvites().map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'revoked an invite',
    summary: `Revoked the invite to ${invite.email}`,
    entityType: 'invite',
    entityId: invite.id,
  });
  return updated;
}

/** "Mark as joined" — the admin's manual close-the-loop action once an
 * invitee has actually shown up, since there's no sign-up flow for them to
 * accept the invite through. */
function convertInviteToMember({ params }: RouteContext): Member {
  const invite = requireInvite(params.inviteId);
  if (invite.status !== 'pending') {
    throw new LocalApiError(400, 'Only a pending invite can be converted');
  }

  const member: Member = {
    id: createMemberId(),
    firstName: invite.firstName ?? invite.email.split('@')[0],
    lastName: invite.lastName ?? '',
    roles: invite.roles.length > 0 ? invite.roles : ['Member'],
    isClubAdmin: false,
    status: 'active',
  };
  writeMembers([...readMembers(), member]);
  writeInvites(
    readInvites().map((entry) =>
      entry.id === invite.id
        ? { ...entry, status: 'accepted' as const, respondedAt: new Date().toISOString() }
        : entry,
    ),
  );
  recordActivity({
    category: 'people',
    action: 'converted an invite to a member',
    summary: `${member.firstName} ${member.lastName} joined as a member`,
    entityType: 'member',
    entityId: member.id,
  });
  return member;
}

function listMeetings(): Meeting[] {
  return readMeetings();
}

function getMeeting({ params }: RouteContext): Meeting {
  const meeting = readMeetings().find((entry) => entry.id === params.meetingId);
  if (!meeting) throw new LocalApiError(404, `No meeting with id "${params.meetingId}"`);
  return meeting;
}

/** Ids are minted here rather than in the form so they stay the server's
 * business — the same call the Nest controller will make. */
function createMeetingId(): string {
  return `mtg-${Date.now().toString(36)}`;
}

/** A new meeting is always a draft: the roster slot exists, but nothing about
 * the run of show does yet. Publishing is a separate call from its own page. */
function createMeeting({ body }: RouteContext): Meeting {
  const input = parseCreateMeetingBody(body);
  const meeting: Meeting = { id: createMeetingId(), ...input, status: 'draft' };
  writeMeetings([...readMeetings(), meeting]);
  recordActivity({
    category: 'meeting',
    action: 'created a meeting',
    summary: `Created the agenda for Meeting ${meeting.meetingNumber}`,
    entityType: 'meeting',
    entityId: meeting.id,
  });
  return meeting;
}

/** Save as Draft and Publish are the same write with a different `status` —
 * the split lives in the meeting page's two buttons, not in two routes. */
function updateMeeting({ params, query, body }: RouteContext): Meeting {
  const existing = getMeeting({ params, query, body });
  const updated: Meeting = { ...existing, ...parseUpdateMeetingBody(body) };
  writeMeetings(readMeetings().map((entry) => (entry.id === existing.id ? updated : entry)));
  recordActivity({
    category: 'meeting',
    action: updated.status === 'published' ? 'published a meeting' : 'updated a meeting',
    summary: `${updated.status === 'published' ? 'Published' : 'Updated'} Meeting ${updated.meetingNumber} — ${updated.theme}`,
    entityType: 'meeting',
    entityId: updated.id,
  });
  return updated;
}

function listGuests(): Guest[] {
  return readGuests();
}

function getGuest({ params }: RouteContext): Guest {
  const guest = readGuests().find((entry) => entry.id === params.guestId);
  if (!guest) throw new LocalApiError(404, `No guest with id "${params.guestId}"`);
  return guest;
}

/** Backs the Kanban drag/drop (stage-only), the mobile stage dropdown, and the
 * edit panel — all three are the same shape of PATCH: whichever fields the
 * caller included get written; the rest are left alone. */
function updateGuest({ params, body }: RouteContext): Guest {
  const guests = readGuests();
  const existing = guests.find((entry) => entry.id === params.guestId);
  if (!existing) throw new LocalApiError(404, `No guest with id "${params.guestId}"`);

  const updated: Guest = { ...existing, ...parseUpdateGuestBody(body) };
  writeGuests(guests.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'updated a guest',
    summary: `Updated guest profile — ${updated.firstName} ${updated.lastName}`,
    entityType: 'guest',
    entityId: updated.id,
  });
  return updated;
}

/** Hard delete — the profile page's Delete action is the only caller for now.
 * Returns `null` to mirror a 204-style empty body without changing the base
 * query contract. */
function deleteGuest({ params }: RouteContext): null {
  const guests = readGuests();
  const existing = guests.find((entry) => entry.id === params.guestId);
  if (!existing) throw new LocalApiError(404, `No guest with id "${params.guestId}"`);
  writeGuests(guests.filter((entry) => entry.id !== params.guestId));
  /* Contact and visit logs cascade — otherwise a re-added guest with the same
   * id (unlikely in prod, common in dev with the seed) would inherit orphaned
   * rows. */
  writeContactLogs(readContactLogs().filter((entry) => entry.guestId !== params.guestId));
  writeVisitLogs(readVisitLogs().filter((entry) => entry.guestId !== params.guestId));
  recordActivity({
    category: 'people',
    action: 'deleted a guest',
    summary: `Deleted guest — ${existing.firstName} ${existing.lastName}`,
    entityType: 'guest',
    entityId: existing.id,
  });
  return null;
}

function parseConvertGuestBody(body: unknown): { roles?: OfficerRole[] } {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object') throw new LocalApiError(400, 'Expected a convert-guest body');
  const { roles } = body as { roles?: unknown };
  /* An absent field and an empty selection both mean "no roles picked" —
   * the caller falls back to plain Member either way. */
  return { roles: Array.isArray(roles) && roles.length > 0 ? parseRoles(roles) : undefined };
}

/** Turns a guest into a member — the guest keeps their record (kept at the
 * `joined-club` stage, not deleted) so the pipeline history stays intact,
 * while a fresh `Member` row starts their roster life. */
function convertGuestToMember({ params, body }: RouteContext): Member {
  const guests = readGuests();
  const guest = guests.find((entry) => entry.id === params.guestId);
  if (!guest) throw new LocalApiError(404, `No guest with id "${params.guestId}"`);
  const { roles } = parseConvertGuestBody(body);

  const member: Member = {
    id: createMemberId(),
    firstName: guest.firstName,
    lastName: guest.lastName,
    roles: roles && roles.length > 0 ? roles : ['Member'],
    isClubAdmin: false,
    status: 'active',
  };
  writeMembers([...readMembers(), member]);
  writeGuests(
    guests.map((entry) =>
      entry.id === guest.id ? { ...entry, stage: 'joined-club' as const } : entry,
    ),
  );
  recordActivity({
    category: 'people',
    action: 'converted a guest to a member',
    summary: `${member.firstName} ${member.lastName} joined as a member`,
    entityType: 'member',
    entityId: member.id,
  });
  return member;
}

/** Guest existence check reused by every contact-log route so a missing guest
 * shows up as a 404 instead of an empty list. */
function requireGuestExists(guestId: string): void {
  const guest = readGuests().find((entry) => entry.id === guestId);
  if (!guest) throw new LocalApiError(404, `No guest with id "${guestId}"`);
}

/** Best-effort label for activity summaries — falls back to the id rather
 * than throwing, since the guest is already known to exist by the time this
 * is called. */
function guestNameFor(guestId: string): string {
  const guest = readGuests().find((entry) => entry.id === guestId);
  return guest ? `${guest.firstName} ${guest.lastName}` : guestId;
}

function parseCreateContactLogBody(body: unknown): CreateContactLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-log body');
  }
  const { method, outcome } = body as Partial<CreateContactLogInput>;
  if (!isContactMethod(method)) {
    throw new LocalApiError(400, `"${String(method)}" is not a contact method`);
  }
  if (typeof outcome !== 'string' || outcome.trim() === '') {
    throw new LocalApiError(400, 'Tell us what happened next');
  }
  if (outcome.length > CONTACT_LOG_OUTCOME_MAX) {
    throw new LocalApiError(400, `Please keep the log under ${CONTACT_LOG_OUTCOME_MAX} characters`);
  }
  return { method, outcome: outcome.trim() };
}

/** Partial patch — the panel always sends both fields today, but the API stays
 * generic so a future "just fix the method" call needs no controller change. */
function parseUpdateContactLogBody(body: unknown): UpdateContactLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-log body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateContactLogInput = {};

  if ('method' in input) {
    if (!isContactMethod(input.method)) {
      throw new LocalApiError(400, `"${String(input.method)}" is not a contact method`);
    }
    output.method = input.method;
  }
  if ('outcome' in input) {
    const raw = input.outcome;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'Tell us what happened next');
    }
    if (raw.length > CONTACT_LOG_OUTCOME_MAX) {
      throw new LocalApiError(
        400,
        `Please keep the log under ${CONTACT_LOG_OUTCOME_MAX} characters`,
      );
    }
    output.outcome = raw.trim();
  }
  return output;
}

function createContactLogId(guestId: string): string {
  return `${guestId}-log-${Date.now().toString(36)}`;
}

function findContactLog(guestId: string, logId: string, logs: ContactLog[]): ContactLog {
  const existing = logs.find((entry) => entry.id === logId && entry.guestId === guestId);
  if (!existing) throw new LocalApiError(404, `No contact log with id "${logId}"`);
  return existing;
}

/** Latest first — the drawer relies on server order rather than sorting on
 * every render. */
function listContactLogs({ params }: RouteContext): ContactLog[] {
  requireGuestExists(params.guestId);
  return readContactLogs()
    .filter((entry) => entry.guestId === params.guestId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function createContactLog({ params, body }: RouteContext): ContactLog {
  requireGuestExists(params.guestId);
  const input = parseCreateContactLogBody(body);
  const log: ContactLog = {
    id: createContactLogId(params.guestId),
    guestId: params.guestId,
    method: input.method,
    outcome: input.outcome,
    createdAt: new Date().toISOString(),
  };
  writeContactLogs([...readContactLogs(), log]);
  recordActivity({
    category: 'people',
    action: 'logged a contact',
    summary: `Logged a ${log.method} contact with ${guestNameFor(params.guestId)}`,
    entityType: 'contactLog',
    entityId: log.id,
  });
  return log;
}

function updateContactLog({ params, body }: RouteContext): ContactLog {
  requireGuestExists(params.guestId);
  const logs = readContactLogs();
  const existing = findContactLog(params.guestId, params.logId, logs);
  const updated: ContactLog = {
    ...existing,
    ...parseUpdateContactLogBody(body),
    updatedAt: new Date().toISOString(),
  };
  writeContactLogs(logs.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'updated a contact log',
    summary: `Updated a contact log for ${guestNameFor(params.guestId)}`,
    entityType: 'contactLog',
    entityId: updated.id,
  });
  return updated;
}

function deleteContactLog({ params }: RouteContext): null {
  requireGuestExists(params.guestId);
  const logs = readContactLogs();
  const existing = findContactLog(params.guestId, params.logId, logs);
  writeContactLogs(logs.filter((entry) => entry.id !== params.logId));
  recordActivity({
    category: 'people',
    action: 'deleted a contact log',
    summary: `Deleted a contact log for ${guestNameFor(params.guestId)}`,
    entityType: 'contactLog',
    entityId: existing.id,
  });
  return null;
}

/** Validates the meeting id + optional role/notes coming from the visit-log
 * form or the automatic writer. Empty strings on optional fields normalise to
 * `undefined` so a cleared input clears the record rather than storing `""`. */
function parseVisitLogFields(
  input: Record<string, unknown>,
  requireMeetingId: boolean,
): { meetingId?: string; role?: string; notes?: string } {
  const output: { meetingId?: string; role?: string; notes?: string } = {};

  if ('meetingId' in input) {
    const raw = input.meetingId;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'meetingId is required');
    }
    if (!readMeetings().some((entry) => entry.id === raw)) {
      throw new LocalApiError(400, `No meeting with id "${raw}"`);
    }
    output.meetingId = raw;
  } else if (requireMeetingId) {
    throw new LocalApiError(400, 'meetingId is required');
  }

  if ('role' in input) {
    const raw = input.role;
    if (raw === undefined || raw === null || raw === '') {
      output.role = undefined;
    } else if (typeof raw !== 'string') {
      throw new LocalApiError(400, 'role must be a string');
    } else {
      const trimmed = raw.trim();
      if (trimmed.length > VISIT_LOG_ROLE_MAX) {
        throw new LocalApiError(400, `Please keep the role under ${VISIT_LOG_ROLE_MAX} characters`);
      }
      output.role = trimmed === '' ? undefined : trimmed;
    }
  }

  if ('notes' in input) {
    const raw = input.notes;
    if (raw === undefined || raw === null || raw === '') {
      output.notes = undefined;
    } else if (typeof raw !== 'string') {
      throw new LocalApiError(400, 'notes must be a string');
    } else {
      if (raw.length > VISIT_LOG_NOTES_MAX) {
        throw new LocalApiError(400, `Please keep notes under ${VISIT_LOG_NOTES_MAX} characters`);
      }
      const trimmed = raw.trim();
      output.notes = trimmed === '' ? undefined : trimmed;
    }
  }

  return output;
}

function parseCreateVisitLogBody(body: unknown): CreateVisitLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-visit-log body');
  }
  const parsed = parseVisitLogFields(body as Record<string, unknown>, true);
  return {
    meetingId: parsed.meetingId as string,
    role: parsed.role,
    notes: parsed.notes,
  };
}

function parseUpdateVisitLogBody(body: unknown): UpdateVisitLogInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-visit-log body');
  }
  return parseVisitLogFields(body as Record<string, unknown>, false);
}

function createVisitLogId(guestId: string): string {
  return `${guestId}-visit-${Date.now().toString(36)}`;
}

function findVisitLog(guestId: string, logId: string, logs: VisitLog[]): VisitLog {
  const existing = logs.find((entry) => entry.id === logId && entry.guestId === guestId);
  if (!existing) throw new LocalApiError(404, `No visit log with id "${logId}"`);
  return existing;
}

/** Newest meeting first — the drawer relies on server order so the list stays
 * consistent whichever surface reads it. Logs pointing at meetings that have
 * been deleted fall to the bottom in creation-time order. */
function listVisitLogs({ params }: RouteContext): VisitLog[] {
  requireGuestExists(params.guestId);
  const meetings = readMeetings();
  const meetingDate = (meetingId: string): string =>
    meetings.find((entry) => entry.id === meetingId)?.dateTime ?? '';
  return readVisitLogs()
    .filter((entry) => entry.guestId === params.guestId)
    .sort((a, b) => {
      const aKey = meetingDate(a.meetingId) || a.createdAt;
      const bKey = meetingDate(b.meetingId) || b.createdAt;
      return aKey < bKey ? 1 : -1;
    });
}

function createVisitLog({ params, body }: RouteContext): VisitLog {
  requireGuestExists(params.guestId);
  const input = parseCreateVisitLogBody(body);
  const log: VisitLog = {
    id: createVisitLogId(params.guestId),
    guestId: params.guestId,
    meetingId: input.meetingId,
    role: input.role,
    notes: input.notes,
    /* Hand-added from the profile — the automatic path (agenda participation)
     * will write these too, but with origin 'meeting'. */
    origin: 'manual',
    createdAt: new Date().toISOString(),
  };
  writeVisitLogs([...readVisitLogs(), log]);
  recordActivity({
    category: 'people',
    action: 'logged a guest visit',
    summary: `Logged a visit — ${guestNameFor(params.guestId)}${log.role ? ` as ${log.role}` : ''}`,
    entityType: 'visitLog',
    entityId: log.id,
  });
  return log;
}

function updateVisitLog({ params, body }: RouteContext): VisitLog {
  requireGuestExists(params.guestId);
  const logs = readVisitLogs();
  const existing = findVisitLog(params.guestId, params.logId, logs);
  const changes = parseUpdateVisitLogBody(body);
  const updated: VisitLog = {
    ...existing,
    ...changes,
    /* Origin is a source-of-record marker, not a "who edited it last" flag —
     * an edited auto log stays auto. */
    origin: existing.origin,
    updatedAt: new Date().toISOString(),
  };
  writeVisitLogs(logs.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'people',
    action: 'updated a guest visit',
    summary: `Updated a visit log for ${guestNameFor(params.guestId)}`,
    entityType: 'visitLog',
    entityId: updated.id,
  });
  return updated;
}

function deleteVisitLog({ params }: RouteContext): null {
  requireGuestExists(params.guestId);
  const logs = readVisitLogs();
  const existing = findVisitLog(params.guestId, params.logId, logs);
  writeVisitLogs(logs.filter((entry) => entry.id !== params.logId));
  recordActivity({
    category: 'people',
    action: 'deleted a guest visit',
    summary: `Deleted a visit log for ${guestNameFor(params.guestId)}`,
    entityType: 'visitLog',
    entityId: existing.id,
  });
  return null;
}

/* --------------------------------------------------------------- assets --- */

function parseCreateAssetBody(body: unknown): CreateAssetInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-asset body');
  }
  const { title, imageUrl, mimeType, width, height, sizeBytes } = body as Partial<CreateAssetInput>;

  if (typeof title !== 'string' || title.trim() === '') {
    throw new LocalApiError(400, 'A title is required');
  }
  if (title.length > ASSET_TITLE_MAX) {
    throw new LocalApiError(400, `Please keep the title under ${ASSET_TITLE_MAX} characters`);
  }
  if (!isAssetMimeType(mimeType)) {
    throw new LocalApiError(400, `"${String(mimeType)}" is not a supported image type`);
  }
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:')) {
    throw new LocalApiError(400, 'A data-URL image payload is required');
  }
  if (
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width < 1 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height < 1
  ) {
    throw new LocalApiError(400, 'Image dimensions must be positive numbers');
  }
  if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
    throw new LocalApiError(400, 'File size must be a non-negative number');
  }
  if (sizeBytes > ASSET_FILE_MAX_BYTES) {
    const mb = (ASSET_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new LocalApiError(400, `Please upload an image under ${mb} MB`);
  }
  return {
    title: title.trim(),
    imageUrl,
    mimeType,
    width: Math.round(width),
    height: Math.round(height),
    sizeBytes: Math.round(sizeBytes),
  };
}

function parseUpdateAssetBody(body: unknown): UpdateAssetInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-asset body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateAssetInput = {};
  if ('title' in input) {
    const raw = input.title;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'A title cannot be blank');
    }
    if (raw.length > ASSET_TITLE_MAX) {
      throw new LocalApiError(400, `Please keep the title under ${ASSET_TITLE_MAX} characters`);
    }
    output.title = raw.trim();
  }
  return output;
}

function createAssetId(): string {
  return `asset-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Paginated list. `q` filters by title (case-insensitive); `offset` and
 * `limit` frame the window. Sorted newest first so both fresh uploads and the
 * seed data land near the top of the grid. */
function listAssets({ query }: RouteContext): AssetsPage {
  const needle = (query.q ?? '').trim().toLowerCase();
  const offset = Number.parseInt(query.offset ?? '0', 10);
  const limit = Number.parseInt(query.limit ?? String(ASSETS_PAGE_SIZE), 10);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, ASSETS_PAGE_SIZE * 4) : ASSETS_PAGE_SIZE;

  const all = sortAssetsNewestFirst(readAssets());
  const filtered = needle ? all.filter((asset) => matchesAssetQuery(asset, needle)) : all;
  const items = filtered.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + items.length < filtered.length ? safeOffset + items.length : null;
  return { items, total: filtered.length, nextOffset };
}

function getAsset({ params }: RouteContext): Asset {
  const asset = readAssets().find((entry) => entry.id === params.assetId);
  if (!asset) throw new LocalApiError(404, `No asset with id "${params.assetId}"`);
  return asset;
}

function createAsset({ body }: RouteContext): Asset {
  const input = parseCreateAssetBody(body);
  const asset: Asset = {
    id: createAssetId(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeAssets([...readAssets(), asset]);
  recordActivity({
    category: 'library',
    action: 'added an asset',
    summary: `Added "${asset.title}" to the asset register`,
    entityType: 'asset',
    entityId: asset.id,
  });
  return asset;
}

function updateAsset({ params, body }: RouteContext): Asset {
  const assets = readAssets();
  const existing = assets.find((entry) => entry.id === params.assetId);
  if (!existing) throw new LocalApiError(404, `No asset with id "${params.assetId}"`);
  const updated: Asset = {
    ...existing,
    ...parseUpdateAssetBody(body),
    updatedAt: new Date().toISOString(),
  };
  writeAssets(assets.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'library',
    action: 'updated an asset',
    summary: `Renamed an asset to "${updated.title}"`,
    entityType: 'asset',
    entityId: updated.id,
  });
  return updated;
}

function deleteAsset({ params }: RouteContext): null {
  const assets = readAssets();
  const existing = assets.find((entry) => entry.id === params.assetId);
  if (!existing) throw new LocalApiError(404, `No asset with id "${params.assetId}"`);
  writeAssets(assets.filter((entry) => entry.id !== params.assetId));
  recordActivity({
    category: 'library',
    action: 'deleted an asset',
    summary: `Deleted asset "${existing.title}"`,
    entityType: 'asset',
    entityId: existing.id,
  });
  return null;
}

/* ------------------------------------------------------------ documents --- */

function parseCreateDocumentBody(body: unknown): CreateDocumentInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-document body');
  }
  const { title, fileName, fileUrl, mimeType, sizeBytes } = body as Partial<CreateDocumentInput>;

  if (typeof title !== 'string' || title.trim() === '') {
    throw new LocalApiError(400, 'A title is required');
  }
  if (title.length > DOCUMENT_TITLE_MAX) {
    throw new LocalApiError(400, `Please keep the title under ${DOCUMENT_TITLE_MAX} characters`);
  }
  if (typeof fileName !== 'string' || fileName.trim() === '') {
    throw new LocalApiError(400, 'A filename is required');
  }
  if (!isDocumentMimeType(mimeType)) {
    throw new LocalApiError(400, `"${String(mimeType)}" is not a supported document type`);
  }
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith('data:')) {
    throw new LocalApiError(400, 'A data-URL file payload is required');
  }
  if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
    throw new LocalApiError(400, 'File size must be a non-negative number');
  }
  if (sizeBytes > DOCUMENT_FILE_MAX_BYTES) {
    const mb = (DOCUMENT_FILE_MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new LocalApiError(400, `Please upload a file under ${mb} MB`);
  }
  return {
    title: title.trim(),
    fileName: fileName.trim(),
    fileUrl,
    mimeType,
    sizeBytes: Math.round(sizeBytes),
  };
}

function parseUpdateDocumentBody(body: unknown): UpdateDocumentInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-document body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateDocumentInput = {};
  if ('title' in input) {
    const raw = input.title;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'A title cannot be blank');
    }
    if (raw.length > DOCUMENT_TITLE_MAX) {
      throw new LocalApiError(400, `Please keep the title under ${DOCUMENT_TITLE_MAX} characters`);
    }
    output.title = raw.trim();
  }
  return output;
}

function createDocumentId(): string {
  return `document-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Paginated list. `q` filters by title or filename (case-insensitive);
 * `offset` and `limit` frame the window. Sorted newest first so both fresh
 * uploads and the seed data land near the top of the list. */
function listDocuments({ query }: RouteContext): DocumentsPage {
  const needle = (query.q ?? '').trim().toLowerCase();
  const offset = Number.parseInt(query.offset ?? '0', 10);
  const limit = Number.parseInt(query.limit ?? String(DOCUMENTS_PAGE_SIZE), 10);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(limit, DOCUMENTS_PAGE_SIZE * 4)
      : DOCUMENTS_PAGE_SIZE;

  const all = sortDocumentsNewestFirst(readDocuments());
  const filtered = needle ? all.filter((doc) => matchesDocumentQuery(doc, needle)) : all;
  const items = filtered.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + items.length < filtered.length ? safeOffset + items.length : null;
  return { items, total: filtered.length, nextOffset };
}

function getDocument({ params }: RouteContext): LibraryDocument {
  const doc = readDocuments().find((entry) => entry.id === params.documentId);
  if (!doc) throw new LocalApiError(404, `No document with id "${params.documentId}"`);
  return doc;
}

function createDocument({ body }: RouteContext): LibraryDocument {
  const input = parseCreateDocumentBody(body);
  const doc: LibraryDocument = {
    id: createDocumentId(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeDocuments([...readDocuments(), doc]);
  recordActivity({
    category: 'library',
    action: 'uploaded a document',
    summary: `Uploaded "${doc.title}" to the library`,
    entityType: 'document',
    entityId: doc.id,
  });
  return doc;
}

function updateDocument({ params, body }: RouteContext): LibraryDocument {
  const docs = readDocuments();
  const existing = docs.find((entry) => entry.id === params.documentId);
  if (!existing) throw new LocalApiError(404, `No document with id "${params.documentId}"`);
  const updated: LibraryDocument = {
    ...existing,
    ...parseUpdateDocumentBody(body),
    updatedAt: new Date().toISOString(),
  };
  writeDocuments(docs.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'library',
    action: 'updated a document',
    summary: `Renamed a document to "${updated.title}"`,
    entityType: 'document',
    entityId: updated.id,
  });
  return updated;
}

function deleteDocument({ params }: RouteContext): null {
  const docs = readDocuments();
  const existing = docs.find((entry) => entry.id === params.documentId);
  if (!existing) throw new LocalApiError(404, `No document with id "${params.documentId}"`);
  writeDocuments(docs.filter((entry) => entry.id !== params.documentId));
  recordActivity({
    category: 'library',
    action: 'deleted a document',
    summary: `Deleted document "${existing.title}"`,
    entityType: 'document',
    entityId: existing.id,
  });
  return null;
}

/* ------------------------------------------------------------ checklists -- */

function requireMeetingExists(meetingId: string): void {
  const meeting = readMeetings().find((entry) => entry.id === meetingId);
  if (!meeting) throw new LocalApiError(404, `No meeting with id "${meetingId}"`);
}

/** Best-effort label for activity summaries — falls back to the id rather
 * than throwing, since the meeting is already known to exist by the time
 * this is called. */
function meetingLabelFor(meetingId: string): string {
  const meeting = readMeetings().find((entry) => entry.id === meetingId);
  return meeting ? `Meeting ${meeting.meetingNumber}` : meetingId;
}

function createChecklistItemId(meetingId: string): string {
  return `${meetingId}-chk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Returns the meeting's checklist, seeding it with the default rows on first
 * read. The seed happens here rather than at DB-init time so a meeting created
 * after the seed run still lands with a helpful starter list. */
function loadChecklistFor(meetingId: string): ChecklistItem[] {
  const table = readChecklists();
  if (table[meetingId]) return table[meetingId];

  const seeded = DEFAULT_CHECKLIST_TEXTS.map((text) => ({
    id: createChecklistItemId(meetingId),
    text,
    done: false,
  }));
  writeChecklists({ ...table, [meetingId]: seeded });
  return seeded;
}

function saveChecklistFor(meetingId: string, items: ChecklistItem[]): void {
  writeChecklists({ ...readChecklists(), [meetingId]: items });
}

function parseCreateChecklistItemBody(body: unknown): CreateChecklistItemInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-checklist-item body');
  }
  const { text } = body as Partial<CreateChecklistItemInput>;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new LocalApiError(400, 'A checklist item needs some text');
  }
  if (text.length > CHECKLIST_ITEM_TEXT_MAX) {
    throw new LocalApiError(
      400,
      `Please keep the item under ${CHECKLIST_ITEM_TEXT_MAX} characters`,
    );
  }
  return { text: text.trim() };
}

function parseUpdateChecklistItemBody(body: unknown): UpdateChecklistItemInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-checklist-item body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateChecklistItemInput = {};
  if ('text' in input) {
    const raw = input.text;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'A checklist item cannot be blank');
    }
    if (raw.length > CHECKLIST_ITEM_TEXT_MAX) {
      throw new LocalApiError(
        400,
        `Please keep the item under ${CHECKLIST_ITEM_TEXT_MAX} characters`,
      );
    }
    output.text = raw.trim();
  }
  if ('done' in input) {
    if (typeof input.done !== 'boolean') {
      throw new LocalApiError(400, 'done must be a boolean');
    }
    output.done = input.done;
  }
  return output;
}

function listChecklist({ params }: RouteContext): ChecklistItem[] {
  requireMeetingExists(params.meetingId);
  return loadChecklistFor(params.meetingId);
}

function createChecklistItem({ params, body }: RouteContext): ChecklistItem {
  requireMeetingExists(params.meetingId);
  const input = parseCreateChecklistItemBody(body);
  const item: ChecklistItem = {
    id: createChecklistItemId(params.meetingId),
    text: input.text,
    done: false,
  };
  const current = loadChecklistFor(params.meetingId);
  saveChecklistFor(params.meetingId, [...current, item]);
  recordActivity({
    category: 'inventory',
    action: 'added a checklist item',
    summary: `Added "${item.text}" to the ${meetingLabelFor(params.meetingId)} checklist`,
    entityType: 'checklistItem',
    entityId: item.id,
  });
  return item;
}

function updateChecklistItem({ params, body }: RouteContext): ChecklistItem {
  requireMeetingExists(params.meetingId);
  const current = loadChecklistFor(params.meetingId);
  const existing = current.find((entry) => entry.id === params.itemId);
  if (!existing) throw new LocalApiError(404, `No checklist item with id "${params.itemId}"`);
  const updated: ChecklistItem = { ...existing, ...parseUpdateChecklistItemBody(body) };
  saveChecklistFor(
    params.meetingId,
    current.map((entry) => (entry.id === updated.id ? updated : entry)),
  );
  if (updated.done !== existing.done) {
    recordActivity({
      category: 'inventory',
      action: updated.done ? 'checked off a checklist item' : 'unchecked a checklist item',
      summary: `${updated.done ? 'Checked off' : 'Unchecked'} "${updated.text}" for ${meetingLabelFor(params.meetingId)}`,
      entityType: 'checklistItem',
      entityId: updated.id,
    });
  }
  return updated;
}

function deleteChecklistItem({ params }: RouteContext): null {
  requireMeetingExists(params.meetingId);
  const current = loadChecklistFor(params.meetingId);
  const existing = current.find((entry) => entry.id === params.itemId);
  if (!existing) {
    throw new LocalApiError(404, `No checklist item with id "${params.itemId}"`);
  }
  saveChecklistFor(
    params.meetingId,
    current.filter((entry) => entry.id !== params.itemId),
  );
  recordActivity({
    category: 'inventory',
    action: 'deleted a checklist item',
    summary: `Deleted "${existing.text}" from the ${meetingLabelFor(params.meetingId)} checklist`,
    entityType: 'checklistItem',
    entityId: existing.id,
  });
  return null;
}

/* --------------------------------------------------------- inventory items -- */

function parseCreateInventoryItemBody(body: unknown): CreateInventoryItemInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-inventory-item body');
  }
  const { title, description, imageUrl, imageMimeType } = body as Partial<CreateInventoryItemInput>;

  if (typeof title !== 'string' || title.trim() === '') {
    throw new LocalApiError(400, 'A title is required');
  }
  if (title.length > INVENTORY_TITLE_MAX) {
    throw new LocalApiError(400, `Please keep the title under ${INVENTORY_TITLE_MAX} characters`);
  }

  const output: CreateInventoryItemInput = { title: title.trim() };

  if (description !== undefined && description !== null && description !== '') {
    if (typeof description !== 'string') {
      throw new LocalApiError(400, 'description must be a string');
    }
    if (description.length > INVENTORY_DESCRIPTION_MAX) {
      throw new LocalApiError(
        400,
        `Please keep the description under ${INVENTORY_DESCRIPTION_MAX} characters`,
      );
    }
    output.description = description.trim();
  }

  if (imageUrl !== undefined && imageUrl !== null && imageUrl !== '') {
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:')) {
      throw new LocalApiError(400, 'A data-URL image payload is required');
    }
    if (!isInventoryImageMimeType(imageMimeType)) {
      throw new LocalApiError(400, `"${String(imageMimeType)}" is not a supported image type`);
    }
    /* Rough size check — a base64 payload is ~4/3 the byte count. Kept as an
     * upper bound rather than exact math because the client already validates
     * against the same ceiling on the way in. */
    const approxBytes = Math.floor((imageUrl.length * 3) / 4);
    if (approxBytes > INVENTORY_IMAGE_MAX_BYTES) {
      const mb = (INVENTORY_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);
      throw new LocalApiError(400, `Please choose an image under ${mb} MB`);
    }
    output.imageUrl = imageUrl;
    output.imageMimeType = imageMimeType;
  }

  return output;
}

function parseUpdateInventoryItemBody(body: unknown): UpdateInventoryItemInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-inventory-item body');
  }
  const input = body as Record<string, unknown>;
  const output: UpdateInventoryItemInput = {};

  if ('title' in input) {
    const raw = input.title;
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new LocalApiError(400, 'A title cannot be blank');
    }
    if (raw.length > INVENTORY_TITLE_MAX) {
      throw new LocalApiError(400, `Please keep the title under ${INVENTORY_TITLE_MAX} characters`);
    }
    output.title = raw.trim();
  }

  if ('description' in input) {
    const raw = input.description;
    if (raw === undefined || raw === null || raw === '') {
      output.description = undefined;
    } else if (typeof raw !== 'string') {
      throw new LocalApiError(400, 'description must be a string');
    } else {
      if (raw.length > INVENTORY_DESCRIPTION_MAX) {
        throw new LocalApiError(
          400,
          `Please keep the description under ${INVENTORY_DESCRIPTION_MAX} characters`,
        );
      }
      output.description = raw.trim();
    }
  }

  if ('imageUrl' in input) {
    const raw = input.imageUrl;
    if (raw === null || raw === '' || raw === undefined) {
      output.imageUrl = null;
      output.imageMimeType = null;
    } else if (typeof raw !== 'string' || !raw.startsWith('data:')) {
      throw new LocalApiError(400, 'A data-URL image payload is required');
    } else {
      if (!isInventoryImageMimeType(input.imageMimeType)) {
        throw new LocalApiError(
          400,
          `"${String(input.imageMimeType)}" is not a supported image type`,
        );
      }
      const approxBytes = Math.floor((raw.length * 3) / 4);
      if (approxBytes > INVENTORY_IMAGE_MAX_BYTES) {
        const mb = (INVENTORY_IMAGE_MAX_BYTES / (1024 * 1024)).toFixed(0);
        throw new LocalApiError(400, `Please choose an image under ${mb} MB`);
      }
      output.imageUrl = raw;
      output.imageMimeType = input.imageMimeType;
    }
  }

  return output;
}

function createInventoryItemId(): string {
  return `inv-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function listInventoryItems(): InventoryItem[] {
  return sortInventoryItemsNewestFirst(readInventoryItems());
}

function getInventoryItem({ params }: RouteContext): InventoryItem {
  const item = readInventoryItems().find((entry) => entry.id === params.itemId);
  if (!item) throw new LocalApiError(404, `No inventory item with id "${params.itemId}"`);
  return item;
}

function createInventoryItem({ body }: RouteContext): InventoryItem {
  const input = parseCreateInventoryItemBody(body);
  const item: InventoryItem = {
    id: createInventoryItemId(),
    title: input.title,
    description: input.description,
    imageUrl: input.imageUrl,
    imageMimeType: input.imageMimeType,
    createdAt: new Date().toISOString(),
  };
  writeInventoryItems([...readInventoryItems(), item]);
  recordActivity({
    category: 'inventory',
    action: 'added an inventory item',
    summary: `Added "${item.title}" to the inventory`,
    entityType: 'inventoryItem',
    entityId: item.id,
  });
  return item;
}

function updateInventoryItem({ params, body }: RouteContext): InventoryItem {
  const items = readInventoryItems();
  const existing = items.find((entry) => entry.id === params.itemId);
  if (!existing) throw new LocalApiError(404, `No inventory item with id "${params.itemId}"`);

  const changes = parseUpdateInventoryItemBody(body);
  /* Assemble the row explicitly so `null` clears through to `undefined` on the
   * stored record — spread would keep the null and skew type checks downstream. */
  const updated: InventoryItem = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };
  if (changes.title !== undefined) updated.title = changes.title;
  if ('description' in changes) updated.description = changes.description;
  if ('imageUrl' in changes) {
    updated.imageUrl = changes.imageUrl ?? undefined;
    updated.imageMimeType = changes.imageMimeType ?? undefined;
  }

  writeInventoryItems(items.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'inventory',
    action: 'updated an inventory item',
    summary: `Updated inventory item "${updated.title}"`,
    entityType: 'inventoryItem',
    entityId: updated.id,
  });
  return updated;
}

function deleteInventoryItem({ params }: RouteContext): null {
  const items = readInventoryItems();
  const existing = items.find((entry) => entry.id === params.itemId);
  if (!existing) throw new LocalApiError(404, `No inventory item with id "${params.itemId}"`);
  writeInventoryItems(items.filter((entry) => entry.id !== params.itemId));
  recordActivity({
    category: 'inventory',
    action: 'deleted an inventory item',
    summary: `Deleted inventory item "${existing.title}"`,
    entityType: 'inventoryItem',
    entityId: existing.id,
  });
  return null;
}

/* ----------------------------------------------------------- transactions -- */

function parseCreateTransactionBody(body: unknown): CreateTransactionInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-transaction body');
  }

  const { date, direction, category, amountMinor, description, method, counterparty, reference } =
    body as Partial<CreateTransactionInput>;

  if (typeof date !== 'string' || Number.isNaN(new Date(date).getTime())) {
    throw new LocalApiError(400, 'A valid date is required');
  }
  if (direction !== 'in' && direction !== 'out') {
    throw new LocalApiError(400, '"direction" must be "in" or "out"');
  }
  if (!isTransactionCategory(category)) {
    throw new LocalApiError(400, `"${String(category)}" is not a transaction category`);
  }
  if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new LocalApiError(400, 'The amount must be a whole number of poisha above zero');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    throw new LocalApiError(400, 'A description is required');
  }
  if (description.trim().length > TRANSACTION_DESCRIPTION_MAX) {
    throw new LocalApiError(
      400,
      `The description must be ${TRANSACTION_DESCRIPTION_MAX} characters or fewer`,
    );
  }
  if (!isPaymentMethod(method)) {
    throw new LocalApiError(400, `"${String(method)}" is not a payment method`);
  }

  const output: CreateTransactionInput = {
    date,
    direction,
    category,
    amountMinor,
    description: description.trim(),
    method,
  };

  if (counterparty !== undefined) {
    if (typeof counterparty !== 'string' || counterparty.length > TRANSACTION_COUNTERPARTY_MAX) {
      throw new LocalApiError(
        400,
        `The counterparty must be ${TRANSACTION_COUNTERPARTY_MAX} characters or fewer`,
      );
    }
    if (counterparty.trim() !== '') output.counterparty = counterparty.trim();
  }
  if (reference !== undefined) {
    if (typeof reference !== 'string' || reference.length > TRANSACTION_REFERENCE_MAX) {
      throw new LocalApiError(
        400,
        `The reference must be ${TRANSACTION_REFERENCE_MAX} characters or fewer`,
      );
    }
    if (reference.trim() !== '') output.reference = reference.trim();
  }

  return output;
}

function parseUpdateTransactionBody(body: unknown): UpdateTransactionInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-transaction body');
  }

  const { date, direction, category, amountMinor, description, method, counterparty, reference } =
    body as Partial<UpdateTransactionInput>;
  const output: UpdateTransactionInput = {};

  if (date !== undefined) {
    if (typeof date !== 'string' || Number.isNaN(new Date(date).getTime())) {
      throw new LocalApiError(400, 'A valid date is required');
    }
    output.date = date;
  }
  if (direction !== undefined) {
    if (direction !== 'in' && direction !== 'out') {
      throw new LocalApiError(400, '"direction" must be "in" or "out"');
    }
    output.direction = direction;
  }
  if (category !== undefined) {
    if (!isTransactionCategory(category)) {
      throw new LocalApiError(400, `"${String(category)}" is not a transaction category`);
    }
    output.category = category;
  }
  if (amountMinor !== undefined) {
    if (typeof amountMinor !== 'number' || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new LocalApiError(400, 'The amount must be a whole number of poisha above zero');
    }
    output.amountMinor = amountMinor;
  }
  if (description !== undefined) {
    if (typeof description !== 'string' || description.trim() === '') {
      throw new LocalApiError(400, 'A description is required');
    }
    if (description.trim().length > TRANSACTION_DESCRIPTION_MAX) {
      throw new LocalApiError(
        400,
        `The description must be ${TRANSACTION_DESCRIPTION_MAX} characters or fewer`,
      );
    }
    output.description = description.trim();
  }
  if (method !== undefined) {
    if (!isPaymentMethod(method)) {
      throw new LocalApiError(400, `"${String(method)}" is not a payment method`);
    }
    output.method = method;
  }
  if (counterparty !== undefined) {
    if (typeof counterparty !== 'string' || counterparty.length > TRANSACTION_COUNTERPARTY_MAX) {
      throw new LocalApiError(
        400,
        `The counterparty must be ${TRANSACTION_COUNTERPARTY_MAX} characters or fewer`,
      );
    }
    output.counterparty = counterparty.trim() === '' ? undefined : counterparty.trim();
  }
  if (reference !== undefined) {
    if (typeof reference !== 'string' || reference.length > TRANSACTION_REFERENCE_MAX) {
      throw new LocalApiError(
        400,
        `The reference must be ${TRANSACTION_REFERENCE_MAX} characters or fewer`,
      );
    }
    output.reference = reference.trim() === '' ? undefined : reference.trim();
  }

  return output;
}

function createTransactionId(): string {
  return `tx-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function listTransactions(): Transaction[] {
  return sortTransactionsNewestFirst(readTransactions());
}

function getTransaction({ params }: RouteContext): Transaction {
  const tx = readTransactions().find((entry) => entry.id === params.transactionId);
  if (!tx) throw new LocalApiError(404, `No transaction with id "${params.transactionId}"`);
  return tx;
}

function createTransaction({ body }: RouteContext): Transaction {
  const input = parseCreateTransactionBody(body);
  const tx: Transaction = {
    id: createTransactionId(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeTransactions([...readTransactions(), tx]);
  recordActivity({
    category: 'finance',
    action: 'logged a transaction',
    summary: `Logged ${tx.direction === 'in' ? 'income' : 'an expense'} — ${tx.description}`,
    entityType: 'transaction',
    entityId: tx.id,
  });
  return tx;
}

/** Entries auto-created from a dues payment carry the payment, not the other
 * way round — editing or deleting them here would let the ledger and the
 * dues record disagree, so both writes are refused and the caller is pointed
 * back at the Dues tab. */
function requireEditableTransaction(
  transactions: Transaction[],
  transactionId: string,
): Transaction {
  const existing = transactions.find((entry) => entry.id === transactionId);
  if (!existing) throw new LocalApiError(404, `No transaction with id "${transactionId}"`);
  if (existing.duesRecordId) {
    throw new LocalApiError(
      409,
      'This entry was recorded from a dues payment — change it from the Dues tab instead.',
    );
  }
  return existing;
}

function updateTransaction({ params, body }: RouteContext): Transaction {
  const transactions = readTransactions();
  const existing = requireEditableTransaction(transactions, params.transactionId);
  const changes = parseUpdateTransactionBody(body);
  const updated: Transaction = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  writeTransactions(transactions.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'finance',
    action: 'updated a transaction',
    summary: `Updated a transaction — ${updated.description}`,
    entityType: 'transaction',
    entityId: updated.id,
  });
  return updated;
}

function deleteTransaction({ params }: RouteContext): null {
  const transactions = readTransactions();
  const existing = requireEditableTransaction(transactions, params.transactionId);
  writeTransactions(transactions.filter((entry) => entry.id !== params.transactionId));
  recordActivity({
    category: 'finance',
    action: 'deleted a transaction',
    summary: `Deleted a transaction — ${existing.description}`,
    entityType: 'transaction',
    entityId: existing.id,
  });
  return null;
}

/* ------------------------------------------------------------ dues records -- */

/** Returns every member's record for the period, materialising a fresh unpaid
 * row for anyone the People roster has grown to include since the period was
 * last read. This is what keeps the Dues tab following the member roster
 * without a separate sync step. */
function listDuesRecords({ query }: RouteContext): DuesRecord[] {
  const periodId = query.periodId;
  if (!periodId) throw new LocalApiError(400, 'A periodId query parameter is required');
  const period = getDuesPeriod(periodId);
  if (!period) throw new LocalApiError(404, `No dues period with id "${periodId}"`);

  const existing = readDuesRecords();
  const members = readMembers();
  const byMemberId = new Map(
    existing
      .filter((record) => record.periodId === periodId)
      .map((record) => [record.memberId, record]),
  );

  let changed = false;
  const now = new Date().toISOString();
  for (const member of members) {
    if (byMemberId.has(member.id)) continue;
    byMemberId.set(member.id, {
      id: `dues-${periodId}-${member.id}`,
      periodId,
      memberId: member.id,
      amountDueMinor: period.standardAmountMinor,
      amountPaidMinor: 0,
      waived: false,
      createdAt: now,
    });
    changed = true;
  }

  const forPeriod = members
    .map((member) => byMemberId.get(member.id))
    .filter((record): record is DuesRecord => record !== undefined);

  if (changed) {
    const otherPeriods = existing.filter((record) => record.periodId !== periodId);
    writeDuesRecords([...otherPeriods, ...forPeriod]);
  }

  return forPeriod;
}

function parseUpdateDuesRecordBody(body: unknown): UpdateDuesRecordInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-dues-record body');
  }

  const { amountPaidMinor, waived, paidOn, method, note } = body as Record<string, unknown>;
  const output: UpdateDuesRecordInput = {};

  if (amountPaidMinor !== undefined) {
    if (
      typeof amountPaidMinor !== 'number' ||
      !Number.isInteger(amountPaidMinor) ||
      amountPaidMinor < 0
    ) {
      throw new LocalApiError(400, 'The amount paid must be a non-negative whole number of poisha');
    }
    output.amountPaidMinor = amountPaidMinor;
  }
  if (waived !== undefined) {
    if (typeof waived !== 'boolean') throw new LocalApiError(400, '"waived" must be a boolean');
    output.waived = waived;
  }
  if (paidOn !== undefined) {
    if (
      paidOn !== null &&
      (typeof paidOn !== 'string' || Number.isNaN(new Date(paidOn).getTime()))
    ) {
      throw new LocalApiError(400, 'paidOn must be a valid date or null');
    }
    output.paidOn = paidOn === null ? null : paidOn;
  }
  if (method !== undefined) {
    if (method !== null && !isPaymentMethod(method)) {
      throw new LocalApiError(400, `"${String(method)}" is not a payment method`);
    }
    output.method = method === null ? null : method;
  }
  if (note !== undefined) {
    if (note !== null && typeof note !== 'string') {
      throw new LocalApiError(400, 'note must be a string or null');
    }
    output.note = note === null ? null : note.trim();
  }

  return output;
}

/** The one write path where two tables change together. Recording a payment
 * (or clearing one) keeps the ledger truthful without the treasurer entering
 * the same payment twice — see `requireEditableTransaction` above for the
 * other half of that guarantee. */
function updateDuesRecord({ params, body }: RouteContext): DuesRecord {
  const records = readDuesRecords();
  const existing = records.find((entry) => entry.id === params.recordId);
  if (!existing) throw new LocalApiError(404, `No dues record with id "${params.recordId}"`);

  const changes = parseUpdateDuesRecordBody(body);
  const updated: DuesRecord = { ...existing, updatedAt: new Date().toISOString() };
  if (changes.amountPaidMinor !== undefined) updated.amountPaidMinor = changes.amountPaidMinor;
  if (changes.waived !== undefined) updated.waived = changes.waived;
  if ('paidOn' in changes) updated.paidOn = changes.paidOn ?? undefined;
  if ('method' in changes) updated.method = changes.method ?? undefined;
  if ('note' in changes) updated.note = changes.note ?? undefined;

  writeDuesRecords(records.map((entry) => (entry.id === updated.id ? updated : entry)));

  const transactions = readTransactions();
  const linked = transactions.find((tx) => tx.duesRecordId === updated.id);
  const period = getDuesPeriod(updated.periodId);
  const member = readMembers().find((entry) => entry.id === updated.memberId);
  const now = new Date().toISOString();

  if (updated.amountPaidMinor > 0 && !updated.waived) {
    if (linked) {
      writeTransactions(
        transactions.map((tx) =>
          tx.id === linked.id
            ? {
                ...tx,
                amountMinor: updated.amountPaidMinor,
                date: updated.paidOn ?? tx.date,
                method: updated.method ?? tx.method,
                updatedAt: now,
              }
            : tx,
        ),
      );
    } else {
      const newTx: Transaction = {
        id: createTransactionId(),
        date: updated.paidOn ?? now.slice(0, 10),
        direction: 'in',
        category: 'dues',
        amountMinor: updated.amountPaidMinor,
        description: `Dues — ${period?.label ?? updated.periodId}`,
        method: updated.method ?? 'cash',
        counterparty: member ? `${member.firstName} ${member.lastName}` : undefined,
        duesRecordId: updated.id,
        createdAt: now,
      };
      writeTransactions([...transactions, newTx]);
    }
  } else if (linked) {
    /* Reset to zero, or waived after already having a recorded payment —
     * retire the linked entry rather than leaving stale income on the ledger. */
    writeTransactions(transactions.filter((tx) => tx.id !== linked.id));
  }

  const memberName = member ? `${member.firstName} ${member.lastName}` : updated.memberId;
  recordActivity({
    category: 'finance',
    action: updated.waived ? 'waived a dues payment' : 'recorded a dues payment',
    summary: updated.waived
      ? `Waived dues for ${memberName}`
      : `Recorded a dues payment from ${memberName}`,
    entityType: 'duesRecord',
    entityId: updated.id,
  });

  return updated;
}

/* ------------------------------------------------------------ budget lines -- */

function parseCreateBudgetLineBody(body: unknown): CreateBudgetLineInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-budget-line body');
  }

  const { fiscalYear, kind, category, plannedMinor, note } = body as Partial<CreateBudgetLineInput>;

  if (typeof fiscalYear !== 'string' || fiscalYear.trim() === '') {
    throw new LocalApiError(400, 'A fiscal year is required');
  }
  if (kind !== 'income' && kind !== 'expense') {
    throw new LocalApiError(400, '"kind" must be "income" or "expense"');
  }
  if (!isTransactionCategory(category)) {
    throw new LocalApiError(400, `"${String(category)}" is not a transaction category`);
  }
  if ((kind === 'income') !== isIncomeCategory(category)) {
    throw new LocalApiError(
      400,
      `"${CATEGORY_LABELS[category]}" is not ${kind === 'income' ? 'an income' : 'an expense'} category`,
    );
  }
  if (typeof plannedMinor !== 'number' || !Number.isInteger(plannedMinor) || plannedMinor < 0) {
    throw new LocalApiError(
      400,
      'The planned amount must be a non-negative whole number of poisha',
    );
  }
  if (
    readBudgetLines().some(
      (line) => line.fiscalYear === fiscalYear.trim() && line.category === category,
    )
  ) {
    throw new LocalApiError(
      409,
      `A budget line for "${CATEGORY_LABELS[category]}" already exists for ${fiscalYear.trim()}`,
    );
  }

  const output: CreateBudgetLineInput = {
    fiscalYear: fiscalYear.trim(),
    kind,
    category,
    plannedMinor,
  };
  if (note !== undefined) {
    if (typeof note !== 'string' || note.length > BUDGET_LINE_NOTE_MAX) {
      throw new LocalApiError(400, `The note must be ${BUDGET_LINE_NOTE_MAX} characters or fewer`);
    }
    if (note.trim() !== '') output.note = note.trim();
  }

  return output;
}

function parseUpdateBudgetLineBody(body: unknown): UpdateBudgetLineInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-budget-line body');
  }

  const { plannedMinor, note } = body as Partial<UpdateBudgetLineInput>;
  const output: UpdateBudgetLineInput = {};

  if (plannedMinor !== undefined) {
    if (typeof plannedMinor !== 'number' || !Number.isInteger(plannedMinor) || plannedMinor < 0) {
      throw new LocalApiError(
        400,
        'The planned amount must be a non-negative whole number of poisha',
      );
    }
    output.plannedMinor = plannedMinor;
  }
  if (note !== undefined) {
    if (note !== null && (typeof note !== 'string' || note.length > BUDGET_LINE_NOTE_MAX)) {
      throw new LocalApiError(400, `The note must be ${BUDGET_LINE_NOTE_MAX} characters or fewer`);
    }
    output.note = note === null ? null : note.trim();
  }

  return output;
}

function createBudgetLine({ body }: RouteContext): BudgetLine {
  const input = parseCreateBudgetLineBody(body);
  const line: BudgetLine = {
    id: `bud-${input.fiscalYear}-${input.category}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeBudgetLines([...readBudgetLines(), line]);
  recordActivity({
    category: 'finance',
    action: 'added a budget line',
    summary: `Added a ${line.fiscalYear} budget line — ${CATEGORY_LABELS[line.category]}`,
    entityType: 'budgetLine',
    entityId: line.id,
  });
  return line;
}

function listBudgetLines({ query }: RouteContext): BudgetLine[] {
  const lines = readBudgetLines();
  return query.fiscalYear ? lines.filter((line) => line.fiscalYear === query.fiscalYear) : lines;
}

function updateBudgetLine({ params, body }: RouteContext): BudgetLine {
  const lines = readBudgetLines();
  const existing = lines.find((entry) => entry.id === params.lineId);
  if (!existing) throw new LocalApiError(404, `No budget line with id "${params.lineId}"`);

  const changes = parseUpdateBudgetLineBody(body);
  const updated: BudgetLine = { ...existing, updatedAt: new Date().toISOString() };
  if (changes.plannedMinor !== undefined) updated.plannedMinor = changes.plannedMinor;
  if ('note' in changes) updated.note = changes.note ?? undefined;

  writeBudgetLines(lines.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'finance',
    action: 'updated a budget line',
    summary: `Updated the ${updated.fiscalYear} budget line — ${CATEGORY_LABELS[updated.category]}`,
    entityType: 'budgetLine',
    entityId: updated.id,
  });
  return updated;
}

function deleteBudgetLine({ params }: RouteContext): null {
  const lines = readBudgetLines();
  const existing = lines.find((entry) => entry.id === params.lineId);
  if (!existing) throw new LocalApiError(404, `No budget line with id "${params.lineId}"`);
  writeBudgetLines(lines.filter((entry) => entry.id !== params.lineId));
  recordActivity({
    category: 'finance',
    action: 'deleted a budget line',
    summary: `Deleted the ${existing.fiscalYear} budget line — ${CATEGORY_LABELS[existing.category]}`,
    entityType: 'budgetLine',
    entityId: existing.id,
  });
  return null;
}

/* --------------------------------------------------------------- org tree -- */

function trimmedNameOrThrow(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new LocalApiError(400, `${label} is required`);
  }
  if (value.trim().length > ORG_NAME_MAX) {
    throw new LocalApiError(400, `${label} must be ${ORG_NAME_MAX} characters or fewer`);
  }
  return value.trim();
}

function createOrgId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function requireDistrict(districtId: string): District {
  const district = readDistricts().find((entry) => entry.id === districtId);
  if (!district) throw new LocalApiError(404, `No district with id "${districtId}"`);
  return district;
}

function requireDivision(divisionId: string): Division {
  const division = readDivisions().find((entry) => entry.id === divisionId);
  if (!division) throw new LocalApiError(404, `No division with id "${divisionId}"`);
  return division;
}

function requireArea(areaId: string): Area {
  const area = readAreas().find((entry) => entry.id === areaId);
  if (!area) throw new LocalApiError(404, `No area with id "${areaId}"`);
  return area;
}

/* ----- districts ----- */

function parseCreateDistrictBody(body: unknown): CreateDistrictInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-district body');
  }
  const { name, code } = body as Partial<CreateDistrictInput>;
  const parsedName = trimmedNameOrThrow(name, 'A district name');
  if (typeof code !== 'string' || code.trim() === '') {
    throw new LocalApiError(400, 'A district code is required');
  }
  if (code.trim().length > DISTRICT_CODE_MAX) {
    throw new LocalApiError(
      400,
      `The district code must be ${DISTRICT_CODE_MAX} characters or fewer`,
    );
  }
  return { name: parsedName, code: code.trim() };
}

function parseUpdateDistrictBody(body: unknown): UpdateDistrictInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-district body');
  }
  const { name, code } = body as Partial<UpdateDistrictInput>;
  const output: UpdateDistrictInput = {};
  if (name !== undefined) output.name = trimmedNameOrThrow(name, 'A district name');
  if (code !== undefined) {
    if (typeof code !== 'string' || code.trim() === '') {
      throw new LocalApiError(400, 'A district code is required');
    }
    if (code.trim().length > DISTRICT_CODE_MAX) {
      throw new LocalApiError(
        400,
        `The district code must be ${DISTRICT_CODE_MAX} characters or fewer`,
      );
    }
    output.code = code.trim();
  }
  return output;
}

function listDistricts(): District[] {
  return readDistricts();
}

function createDistrict({ body }: RouteContext): District {
  const input = parseCreateDistrictBody(body);
  const district: District = {
    id: createOrgId('dist'),
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeDistricts([...readDistricts(), district]);
  recordActivity({
    category: 'org',
    action: 'created a district',
    summary: `Created district — ${district.name}`,
    entityType: 'district',
    entityId: district.id,
  });
  return district;
}

function updateDistrict({ params, body }: RouteContext): District {
  const districts = readDistricts();
  const existing = districts.find((entry) => entry.id === params.districtId);
  if (!existing) throw new LocalApiError(404, `No district with id "${params.districtId}"`);
  const changes = parseUpdateDistrictBody(body);
  const updated: District = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  writeDistricts(districts.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'org',
    action: 'updated a district',
    summary: `Updated district — ${updated.name}`,
    entityType: 'district',
    entityId: updated.id,
  });
  return updated;
}

function deleteDistrict({ params }: RouteContext): null {
  const districts = readDistricts();
  const existing = districts.find((entry) => entry.id === params.districtId);
  if (!existing) throw new LocalApiError(404, `No district with id "${params.districtId}"`);

  const divisions = readDivisions();
  const doomedDivisionIds = new Set(
    divisions
      .filter((division) => division.districtId === existing.id)
      .map((division) => division.id),
  );
  const areas = readAreas();
  const doomedAreaIds = new Set(
    areas.filter((area) => doomedDivisionIds.has(area.divisionId)).map((area) => area.id),
  );
  const clubs = readOrgClubs();

  writeOrgClubs(clubs.filter((club) => !doomedAreaIds.has(club.areaId)));
  writeAreas(areas.filter((area) => !doomedAreaIds.has(area.id)));
  writeDivisions(divisions.filter((division) => !doomedDivisionIds.has(division.id)));
  writeDistricts(districts.filter((entry) => entry.id !== existing.id));

  recordActivity({
    category: 'org',
    action: 'deleted a district',
    summary: `Deleted district — ${existing.name}, along with everything under it`,
    entityType: 'district',
    entityId: existing.id,
  });
  return null;
}

/* ----- divisions ----- */

function parseCreateDivisionBody(body: unknown): CreateDivisionInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-division body');
  }
  const { districtId, name } = body as Partial<CreateDivisionInput>;
  if (typeof districtId !== 'string' || districtId.trim() === '') {
    throw new LocalApiError(400, 'districtId is required');
  }
  requireDistrict(districtId);
  return { districtId, name: trimmedNameOrThrow(name, 'A division name') };
}

function parseUpdateDivisionBody(body: unknown): UpdateDivisionInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-division body');
  }
  const { name, districtId } = body as Partial<UpdateDivisionInput>;
  const output: UpdateDivisionInput = {};
  if (name !== undefined) output.name = trimmedNameOrThrow(name, 'A division name');
  if (districtId !== undefined) {
    if (typeof districtId !== 'string' || districtId.trim() === '') {
      throw new LocalApiError(400, 'districtId is required');
    }
    requireDistrict(districtId);
    output.districtId = districtId;
  }
  return output;
}

function listDivisions({ query }: RouteContext): Division[] {
  const divisions = readDivisions();
  return query.districtId
    ? divisions.filter((division) => division.districtId === query.districtId)
    : divisions;
}

function createDivision({ body }: RouteContext): Division {
  const input = parseCreateDivisionBody(body);
  const division: Division = {
    id: createOrgId('div'),
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeDivisions([...readDivisions(), division]);
  recordActivity({
    category: 'org',
    action: 'created a division',
    summary: `Created division — ${division.name}`,
    entityType: 'division',
    entityId: division.id,
  });
  return division;
}

function updateDivision({ params, body }: RouteContext): Division {
  const divisions = readDivisions();
  const existing = divisions.find((entry) => entry.id === params.divisionId);
  if (!existing) throw new LocalApiError(404, `No division with id "${params.divisionId}"`);
  const changes = parseUpdateDivisionBody(body);
  const moved = changes.districtId !== undefined && changes.districtId !== existing.districtId;
  const updated: Division = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  writeDivisions(divisions.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'org',
    action: moved ? 'moved a division' : 'updated a division',
    summary: moved
      ? `Moved division ${updated.name} to a different district`
      : `Updated division — ${updated.name}`,
    entityType: 'division',
    entityId: updated.id,
  });
  return updated;
}

function deleteDivision({ params }: RouteContext): null {
  const divisions = readDivisions();
  const existing = divisions.find((entry) => entry.id === params.divisionId);
  if (!existing) throw new LocalApiError(404, `No division with id "${params.divisionId}"`);

  const areas = readAreas();
  const doomedAreaIds = new Set(
    areas.filter((area) => area.divisionId === existing.id).map((area) => area.id),
  );
  const clubs = readOrgClubs();

  writeOrgClubs(clubs.filter((club) => !doomedAreaIds.has(club.areaId)));
  writeAreas(areas.filter((area) => !doomedAreaIds.has(area.id)));
  writeDivisions(divisions.filter((entry) => entry.id !== existing.id));

  recordActivity({
    category: 'org',
    action: 'deleted a division',
    summary: `Deleted division — ${existing.name}, along with everything under it`,
    entityType: 'division',
    entityId: existing.id,
  });
  return null;
}

/* ----- areas ----- */

function parseCreateAreaBody(body: unknown): CreateAreaInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-area body');
  }
  const { divisionId, name } = body as Partial<CreateAreaInput>;
  if (typeof divisionId !== 'string' || divisionId.trim() === '') {
    throw new LocalApiError(400, 'divisionId is required');
  }
  requireDivision(divisionId);
  return { divisionId, name: trimmedNameOrThrow(name, 'An area name') };
}

function parseUpdateAreaBody(body: unknown): UpdateAreaInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-area body');
  }
  const { name, divisionId } = body as Partial<UpdateAreaInput>;
  const output: UpdateAreaInput = {};
  if (name !== undefined) output.name = trimmedNameOrThrow(name, 'An area name');
  if (divisionId !== undefined) {
    if (typeof divisionId !== 'string' || divisionId.trim() === '') {
      throw new LocalApiError(400, 'divisionId is required');
    }
    requireDivision(divisionId);
    output.divisionId = divisionId;
  }
  return output;
}

function listAreas({ query }: RouteContext): Area[] {
  const areas = readAreas();
  return query.divisionId ? areas.filter((area) => area.divisionId === query.divisionId) : areas;
}

function createArea({ body }: RouteContext): Area {
  const input = parseCreateAreaBody(body);
  const area: Area = { id: createOrgId('area'), ...input, createdAt: new Date().toISOString() };
  writeAreas([...readAreas(), area]);
  recordActivity({
    category: 'org',
    action: 'created an area',
    summary: `Created area — ${area.name}`,
    entityType: 'area',
    entityId: area.id,
  });
  return area;
}

function updateArea({ params, body }: RouteContext): Area {
  const areas = readAreas();
  const existing = areas.find((entry) => entry.id === params.areaId);
  if (!existing) throw new LocalApiError(404, `No area with id "${params.areaId}"`);
  const changes = parseUpdateAreaBody(body);
  const moved = changes.divisionId !== undefined && changes.divisionId !== existing.divisionId;
  const updated: Area = { ...existing, ...changes, updatedAt: new Date().toISOString() };
  writeAreas(areas.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'org',
    action: moved ? 'moved an area' : 'updated an area',
    summary: moved
      ? `Moved area ${updated.name} to a different division`
      : `Updated area — ${updated.name}`,
    entityType: 'area',
    entityId: updated.id,
  });
  return updated;
}

function deleteArea({ params }: RouteContext): null {
  const areas = readAreas();
  const existing = areas.find((entry) => entry.id === params.areaId);
  if (!existing) throw new LocalApiError(404, `No area with id "${params.areaId}"`);

  const clubs = readOrgClubs();
  writeOrgClubs(clubs.filter((club) => club.areaId !== existing.id));
  writeAreas(areas.filter((entry) => entry.id !== existing.id));

  recordActivity({
    category: 'org',
    action: 'deleted an area',
    summary: `Deleted area — ${existing.name}, along with its clubs`,
    entityType: 'area',
    entityId: existing.id,
  });
  return null;
}

/* ----- org clubs ----- */

function parseCreateOrgClubBody(body: unknown): CreateOrgClubInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-club body');
  }
  const { areaId, name, clubNumber, status } = body as Partial<CreateOrgClubInput>;
  if (typeof areaId !== 'string' || areaId.trim() === '') {
    throw new LocalApiError(400, 'areaId is required');
  }
  requireArea(areaId);
  const output: CreateOrgClubInput = { areaId, name: trimmedNameOrThrow(name, 'A club name') };
  if (clubNumber !== undefined) {
    if (typeof clubNumber !== 'string' || clubNumber.length > CLUB_NUMBER_MAX) {
      throw new LocalApiError(
        400,
        `The club number must be ${CLUB_NUMBER_MAX} characters or fewer`,
      );
    }
    if (clubNumber.trim() !== '') output.clubNumber = clubNumber.trim();
  }
  if (status !== undefined) {
    if (!isOrgClubStatus(status)) {
      throw new LocalApiError(400, `"${String(status)}" is not a club status`);
    }
    output.status = status;
  }
  return output;
}

function parseUpdateOrgClubBody(body: unknown): UpdateOrgClubInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-club body');
  }
  const { name, clubNumber, status, areaId } = body as Partial<UpdateOrgClubInput>;
  const output: UpdateOrgClubInput = {};
  if (name !== undefined) output.name = trimmedNameOrThrow(name, 'A club name');
  if (clubNumber !== undefined) {
    if (
      clubNumber !== null &&
      (typeof clubNumber !== 'string' || clubNumber.length > CLUB_NUMBER_MAX)
    ) {
      throw new LocalApiError(
        400,
        `The club number must be ${CLUB_NUMBER_MAX} characters or fewer`,
      );
    }
    output.clubNumber = clubNumber === null ? null : clubNumber.trim();
  }
  if (status !== undefined) {
    if (!isOrgClubStatus(status)) {
      throw new LocalApiError(400, `"${String(status)}" is not a club status`);
    }
    output.status = status;
  }
  if (areaId !== undefined) {
    if (typeof areaId !== 'string' || areaId.trim() === '') {
      throw new LocalApiError(400, 'areaId is required');
    }
    requireArea(areaId);
    output.areaId = areaId;
  }
  return output;
}

function listOrgClubs({ query }: RouteContext): OrgClub[] {
  const clubs = readOrgClubs();
  return query.areaId ? clubs.filter((club) => club.areaId === query.areaId) : clubs;
}

function createOrgClub({ body }: RouteContext): OrgClub {
  const input = parseCreateOrgClubBody(body);
  const club: OrgClub = {
    id: createOrgId('club'),
    status: 'active',
    ...input,
    createdAt: new Date().toISOString(),
  };
  writeOrgClubs([...readOrgClubs(), club]);
  recordActivity({
    category: 'org',
    action: 'added a club',
    summary: `Added club — ${club.name}`,
    entityType: 'orgClub',
    entityId: club.id,
  });
  return club;
}

function updateOrgClub({ params, body }: RouteContext): OrgClub {
  const clubs = readOrgClubs();
  const existing = clubs.find((entry) => entry.id === params.clubId);
  if (!existing) throw new LocalApiError(404, `No club with id "${params.clubId}"`);
  const changes = parseUpdateOrgClubBody(body);
  const moved = changes.areaId !== undefined && changes.areaId !== existing.areaId;
  const updated: OrgClub = { ...existing, updatedAt: new Date().toISOString() };
  if (changes.name !== undefined) updated.name = changes.name;
  if ('clubNumber' in changes) updated.clubNumber = changes.clubNumber ?? undefined;
  if (changes.status !== undefined) updated.status = changes.status;
  if (changes.areaId !== undefined) updated.areaId = changes.areaId;

  writeOrgClubs(clubs.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'org',
    action: moved ? 'moved a club' : 'updated a club',
    summary: moved
      ? `Moved club ${updated.name} to a different area`
      : `Updated club — ${updated.name}`,
    entityType: 'orgClub',
    entityId: updated.id,
  });
  return updated;
}

function deleteOrgClub({ params }: RouteContext): null {
  const clubs = readOrgClubs();
  const existing = clubs.find((entry) => entry.id === params.clubId);
  if (!existing) throw new LocalApiError(404, `No club with id "${params.clubId}"`);
  writeOrgClubs(clubs.filter((entry) => entry.id !== existing.id));
  recordActivity({
    category: 'org',
    action: 'deleted a club',
    summary: `Deleted club — ${existing.name}`,
    entityType: 'orgClub',
    entityId: existing.id,
  });
  return null;
}

/* -------------------------------------------------------- me: speech reports -- */

/** The three reports a speech collects, all keyed by the `speech-given`
 * history event they belong to — the Me page joins them back to the event
 * client-side rather than each report re-storing the speech's own fields. */
function listEvaluations({ params }: RouteContext): Evaluation[] {
  requireMember(params.memberId);
  return readEvaluations().filter((entry) => entry.memberId === params.memberId);
}

function listTimerEntries({ params }: RouteContext): TimerEntry[] {
  requireMember(params.memberId);
  return readTimerEntries().filter((entry) => entry.memberId === params.memberId);
}

function listAhCounterEntries({ params }: RouteContext): AhCounterEntry[] {
  requireMember(params.memberId);
  return readAhCounterEntries().filter((entry) => entry.memberId === params.memberId);
}

/* ------------------------------------------------------ speech slot requests -- */

function parseCreateSpeechSlotRequestBody(body: unknown): CreateSpeechSlotRequestInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected a create-speech-slot-request body');
  }
  const { meetingId, projectName, note } = body as Partial<CreateSpeechSlotRequestInput>;

  if (typeof meetingId !== 'string' || meetingId.trim() === '') {
    throw new LocalApiError(400, 'meetingId is required');
  }
  if (!readMeetings().some((entry) => entry.id === meetingId)) {
    throw new LocalApiError(400, `No meeting with id "${meetingId}"`);
  }
  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') throw new LocalApiError(400, 'note must be a string');
    if (note.length > SPEECH_SLOT_REQUEST_NOTE_MAX) {
      throw new LocalApiError(
        400,
        `Please keep the note under ${SPEECH_SLOT_REQUEST_NOTE_MAX} characters`,
      );
    }
  }

  return {
    meetingId,
    projectName:
      typeof projectName === 'string' && projectName.trim() !== '' ? projectName.trim() : undefined,
    note: typeof note === 'string' && note.trim() !== '' ? note.trim() : undefined,
  };
}

/** Latest first — the Me page reads server order rather than sorting on
 * every render, same convention as the contact/visit log lists. */
function listSpeechSlotRequests({ params }: RouteContext): SpeechSlotRequest[] {
  requireMember(params.memberId);
  return readSpeechSlotRequests()
    .filter((entry) => entry.memberId === params.memberId)
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

/** Always lands as `pending` — only the VPE's own review action (not built
 * yet) can move the status, so the member-facing form can't self-approve. */
function createSpeechSlotRequest({ params, body }: RouteContext): SpeechSlotRequest {
  const member = requireMember(params.memberId);
  const input = parseCreateSpeechSlotRequestBody(body);
  const request: SpeechSlotRequest = {
    id: `ssr-${member.id}-${Date.now().toString(36)}`,
    memberId: member.id,
    meetingId: input.meetingId,
    projectName: input.projectName,
    note: input.note,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  writeSpeechSlotRequests([...readSpeechSlotRequests(), request]);
  recordActivity({
    category: 'education',
    action: 'requested a speech slot',
    summary: `Requested a speech slot for ${meetingLabelFor(input.meetingId)}`,
    entityType: 'speechSlotRequest',
    entityId: request.id,
  });
  return request;
}

/* ------------------------------------------------------------------- tasks -- */

function listTasks({ params }: RouteContext): Task[] {
  requireMember(params.memberId);
  return readTasks()
    .filter((entry) => entry.memberId === params.memberId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function parseUpdateTaskBody(body: unknown): UpdateTaskInput {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-task body');
  }
  const { done } = body as Partial<UpdateTaskInput>;
  if (typeof done !== 'boolean') throw new LocalApiError(400, 'done must be a boolean');
  return { done };
}

function updateTask({ params, body }: RouteContext): Task {
  const tasks = readTasks();
  const existing = tasks.find((entry) => entry.id === params.taskId);
  if (!existing) throw new LocalApiError(404, `No task with id "${params.taskId}"`);
  const updated: Task = { ...existing, ...parseUpdateTaskBody(body) };
  writeTasks(tasks.map((entry) => (entry.id === updated.id ? updated : entry)));
  recordActivity({
    category: 'task',
    action: updated.done ? 'completed a task' : 'reopened a task',
    summary: `${updated.done ? 'Completed' : 'Reopened'} "${updated.title}"`,
    entityType: 'task',
    entityId: updated.id,
  });
  return updated;
}

/* -------------------------------------------------------------- activity -- */

function listActivityLogs(): ActivityLog[] {
  return sortActivityLogsNewestFirst(readActivityLogs());
}

interface Route {
  method: HttpMethod;
  /** Path split on `/`; a `:name` segment captures into `params`. */
  segments: string[];
  handler: RouteHandler;
  /** When set, `handleLocalRequest` checks `CURRENT_MEMBER_ID`'s permission
   * for this module before running the handler — `read` for GET, `mutate`
   * for everything else. Routes without a module (member reads, the org-tier
   * dashboards) stay ungated, same as today. */
  module?: ModuleKey;
}

function route(method: HttpMethod, path: string, handler: RouteHandler, module?: ModuleKey): Route {
  return { method, segments: toSegments(path), handler, module };
}

const ROUTES: Route[] = [
  route('GET', '/members', listMembers),
  route('GET', '/members/:memberId', getMember),
  route('GET', '/members/:memberId/history', getMemberHistory),
  route('GET', '/members/:memberId/stats', getMemberStats),
  route('POST', '/members/:memberId/pathway', startPathway, 'education'),
  route('POST', '/members', createMember, 'clubAdmin'),
  route('PATCH', '/members/:memberId', updateMember, 'clubAdmin'),
  route('POST', '/members/:memberId/status', setMemberStatus, 'clubAdmin'),
  route('POST', '/members/:memberId/admin', setMemberAdmin, 'clubAdmin'),
  route('PATCH', '/members/:memberId/permissions', setMemberPermissions, 'clubAdmin'),
  route('GET', '/invites', listInvites, 'clubAdmin'),
  route('POST', '/invites', createInvite, 'clubAdmin'),
  route('DELETE', '/invites/:inviteId', revokeInvite, 'clubAdmin'),
  route('POST', '/invites/:inviteId/convert', convertInviteToMember, 'clubAdmin'),
  route('GET', '/meetings', listMeetings, 'meetings'),
  route('GET', '/meetings/:meetingId', getMeeting, 'meetings'),
  route('POST', '/meetings', createMeeting, 'meetings'),
  route('PATCH', '/meetings/:meetingId', updateMeeting, 'meetings'),
  route('GET', '/guests', listGuests, 'people'),
  route('GET', '/guests/:guestId', getGuest, 'people'),
  route('PATCH', '/guests/:guestId', updateGuest, 'people'),
  route('DELETE', '/guests/:guestId', deleteGuest, 'people'),
  route('POST', '/guests/:guestId/convert-to-member', convertGuestToMember, 'people'),
  route('GET', '/guests/:guestId/contact-logs', listContactLogs, 'people'),
  route('POST', '/guests/:guestId/contact-logs', createContactLog, 'people'),
  route('PATCH', '/guests/:guestId/contact-logs/:logId', updateContactLog, 'people'),
  route('DELETE', '/guests/:guestId/contact-logs/:logId', deleteContactLog, 'people'),
  route('GET', '/guests/:guestId/visit-logs', listVisitLogs, 'people'),
  route('POST', '/guests/:guestId/visit-logs', createVisitLog, 'people'),
  route('PATCH', '/guests/:guestId/visit-logs/:logId', updateVisitLog, 'people'),
  route('DELETE', '/guests/:guestId/visit-logs/:logId', deleteVisitLog, 'people'),
  route('GET', '/assets', listAssets, 'library'),
  route('GET', '/assets/:assetId', getAsset, 'library'),
  route('POST', '/assets', createAsset, 'library'),
  route('PATCH', '/assets/:assetId', updateAsset, 'library'),
  route('DELETE', '/assets/:assetId', deleteAsset, 'library'),
  route('GET', '/documents', listDocuments, 'library'),
  route('GET', '/documents/:documentId', getDocument, 'library'),
  route('POST', '/documents', createDocument, 'library'),
  route('PATCH', '/documents/:documentId', updateDocument, 'library'),
  route('DELETE', '/documents/:documentId', deleteDocument, 'library'),
  route('GET', '/meetings/:meetingId/checklist', listChecklist, 'meetings'),
  route('POST', '/meetings/:meetingId/checklist', createChecklistItem, 'meetings'),
  route('PATCH', '/meetings/:meetingId/checklist/:itemId', updateChecklistItem, 'meetings'),
  route('DELETE', '/meetings/:meetingId/checklist/:itemId', deleteChecklistItem, 'meetings'),
  route('GET', '/inventory-items', listInventoryItems, 'inventory'),
  route('GET', '/inventory-items/:itemId', getInventoryItem, 'inventory'),
  route('POST', '/inventory-items', createInventoryItem, 'inventory'),
  route('PATCH', '/inventory-items/:itemId', updateInventoryItem, 'inventory'),
  route('DELETE', '/inventory-items/:itemId', deleteInventoryItem, 'inventory'),
  route('GET', '/transactions', listTransactions, 'finance'),
  route('GET', '/transactions/:transactionId', getTransaction, 'finance'),
  route('POST', '/transactions', createTransaction, 'finance'),
  route('PATCH', '/transactions/:transactionId', updateTransaction, 'finance'),
  route('DELETE', '/transactions/:transactionId', deleteTransaction, 'finance'),
  route('GET', '/dues-records', listDuesRecords, 'finance'),
  route('PATCH', '/dues-records/:recordId', updateDuesRecord, 'finance'),
  route('GET', '/budget-lines', listBudgetLines, 'finance'),
  route('POST', '/budget-lines', createBudgetLine, 'finance'),
  route('PATCH', '/budget-lines/:lineId', updateBudgetLine, 'finance'),
  route('DELETE', '/budget-lines/:lineId', deleteBudgetLine, 'finance'),
  route('GET', '/members/:memberId/evaluations', listEvaluations),
  route('GET', '/members/:memberId/timer-entries', listTimerEntries),
  route('GET', '/members/:memberId/ah-counter-entries', listAhCounterEntries),
  route('GET', '/members/:memberId/speech-slot-requests', listSpeechSlotRequests),
  route('POST', '/members/:memberId/speech-slot-requests', createSpeechSlotRequest),
  route('GET', '/members/:memberId/tasks', listTasks),
  route('PATCH', '/tasks/:taskId', updateTask),
  route('GET', '/activity-logs', listActivityLogs, 'activityLogs'),
  route('GET', '/districts', listDistricts),
  route('POST', '/districts', createDistrict),
  route('PATCH', '/districts/:districtId', updateDistrict),
  route('DELETE', '/districts/:districtId', deleteDistrict),
  route('GET', '/divisions', listDivisions),
  route('POST', '/divisions', createDivision),
  route('PATCH', '/divisions/:divisionId', updateDivision),
  route('DELETE', '/divisions/:divisionId', deleteDivision),
  route('GET', '/areas', listAreas),
  route('POST', '/areas', createArea),
  route('PATCH', '/areas/:areaId', updateArea),
  route('DELETE', '/areas/:areaId', deleteArea),
  route('GET', '/org-clubs', listOrgClubs),
  route('POST', '/org-clubs', createOrgClub),
  route('PATCH', '/org-clubs/:clubId', updateOrgClub),
  route('DELETE', '/org-clubs/:clubId', deleteOrgClub),
];

function toSegments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean);
}

function parseQuery(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return {};
  const search = new URLSearchParams(url.slice(queryIndex + 1));
  const out: Record<string, string> = {};
  for (const [key, value] of search) out[key] = value;
  return out;
}

function matchRoute(
  method: HttpMethod,
  url: string,
): { route: Route; params: Record<string, string> } | null {
  const segments = toSegments(url);

  for (const candidate of ROUTES) {
    if (candidate.method !== method) continue;
    if (candidate.segments.length !== segments.length) continue;

    const params: Record<string, string> = {};
    const matched = candidate.segments.every((pattern, index) => {
      if (pattern.startsWith(':')) {
        params[pattern.slice(1)] = decodeURIComponent(segments[index]);
        return true;
      }
      return pattern === segments[index];
    });

    if (matched) return { route: candidate, params };
  }

  return null;
}

/** The single enforcement chokepoint for the whole mock API — every module
 * route (see the `module` tag on each `route()` call below) passes through
 * here before its handler runs, the same way a real Nest guard would sit in
 * front of every controller method. `read` gates GET, `mutate` gates
 * everything else, checked against `CURRENT_MEMBER_ID`'s effective
 * permission (`getEffectivePermission`) — a Club Admin always passes, a
 * member without the right grant gets a 403 instead of reaching the handler. */
function assertModuleAccess(module: ModuleKey | undefined, method: HttpMethod): void {
  if (!module) return;
  const actor = requireMember(CURRENT_MEMBER_ID);
  const permission = getEffectivePermission(actor, module);
  const need = method === 'GET' ? 'read' : 'mutate';
  if (!permission[need]) {
    throw new LocalApiError(
      403,
      `You don't have ${need} access to ${module}. Ask a Club Admin to grant it.`,
    );
  }
}

/** Resolves a request against the route table. Throws `LocalApiError` for
 * anything a real server would answer with a 4xx. */
export function handleLocalRequest(request: LocalRequest): unknown {
  const method = request.method ?? 'GET';
  const match = matchRoute(method, request.url);
  if (!match) throw new LocalApiError(404, `No local route for ${method} ${request.url}`);

  assertModuleAccess(match.route.module, method);

  return match.route.handler({
    params: match.params,
    query: parseQuery(request.url),
    body: request.body,
  });
}
