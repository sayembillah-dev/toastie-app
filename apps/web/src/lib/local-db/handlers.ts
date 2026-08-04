import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import { computeMemberStats, sortEvents } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import { findProject } from '@/lib/education/pathways';
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
import type { CreateMeetingInput, Meeting, UpdateMeetingInput } from '@/lib/meetings/meetings';
import { MEETING_STATUSES } from '@/lib/meetings/meetings';
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

import {
  readAssets,
  readBudgetLines,
  readChecklists,
  readContactLogs,
  readDocuments,
  readDuesRecords,
  readExtrasFor,
  readGuests,
  readHistoryEvents,
  readInventoryItems,
  readMeetings,
  readMembers,
  readTransactions,
  readVisitLogs,
  writeAssets,
  writeBudgetLines,
  writeChecklists,
  writeContactLogs,
  writeDocuments,
  writeDuesRecords,
  writeGuests,
  writeHistoryEvents,
  writeInventoryItems,
  writeMeetings,
  writeMembers,
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

function listMembers(): Member[] {
  return readMembers();
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

  return updated;
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
  return meeting;
}

/** Save as Draft and Publish are the same write with a different `status` —
 * the split lives in the meeting page's two buttons, not in two routes. */
function updateMeeting({ params, query, body }: RouteContext): Meeting {
  const existing = getMeeting({ params, query, body });
  const updated: Meeting = { ...existing, ...parseUpdateMeetingBody(body) };
  writeMeetings(readMeetings().map((entry) => (entry.id === existing.id ? updated : entry)));
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
  return null;
}

/** Guest existence check reused by every contact-log route so a missing guest
 * shows up as a 404 instead of an empty list. */
function requireGuestExists(guestId: string): void {
  const guest = readGuests().find((entry) => entry.id === guestId);
  if (!guest) throw new LocalApiError(404, `No guest with id "${guestId}"`);
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
  return updated;
}

function deleteContactLog({ params }: RouteContext): null {
  requireGuestExists(params.guestId);
  const logs = readContactLogs();
  findContactLog(params.guestId, params.logId, logs);
  writeContactLogs(logs.filter((entry) => entry.id !== params.logId));
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
  return updated;
}

function deleteVisitLog({ params }: RouteContext): null {
  requireGuestExists(params.guestId);
  const logs = readVisitLogs();
  findVisitLog(params.guestId, params.logId, logs);
  writeVisitLogs(logs.filter((entry) => entry.id !== params.logId));
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
  return updated;
}

function deleteAsset({ params }: RouteContext): null {
  const assets = readAssets();
  const existing = assets.find((entry) => entry.id === params.assetId);
  if (!existing) throw new LocalApiError(404, `No asset with id "${params.assetId}"`);
  writeAssets(assets.filter((entry) => entry.id !== params.assetId));
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
  return updated;
}

function deleteDocument({ params }: RouteContext): null {
  const docs = readDocuments();
  const existing = docs.find((entry) => entry.id === params.documentId);
  if (!existing) throw new LocalApiError(404, `No document with id "${params.documentId}"`);
  writeDocuments(docs.filter((entry) => entry.id !== params.documentId));
  return null;
}

/* ------------------------------------------------------------ checklists -- */

function requireMeetingExists(meetingId: string): void {
  const meeting = readMeetings().find((entry) => entry.id === meetingId);
  if (!meeting) throw new LocalApiError(404, `No meeting with id "${meetingId}"`);
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
  return updated;
}

function deleteChecklistItem({ params }: RouteContext): null {
  requireMeetingExists(params.meetingId);
  const current = loadChecklistFor(params.meetingId);
  if (!current.some((entry) => entry.id === params.itemId)) {
    throw new LocalApiError(404, `No checklist item with id "${params.itemId}"`);
  }
  saveChecklistFor(
    params.meetingId,
    current.filter((entry) => entry.id !== params.itemId),
  );
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
  return updated;
}

function deleteInventoryItem({ params }: RouteContext): null {
  const items = readInventoryItems();
  const existing = items.find((entry) => entry.id === params.itemId);
  if (!existing) throw new LocalApiError(404, `No inventory item with id "${params.itemId}"`);
  writeInventoryItems(items.filter((entry) => entry.id !== params.itemId));
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
  return updated;
}

function deleteTransaction({ params }: RouteContext): null {
  const transactions = readTransactions();
  requireEditableTransaction(transactions, params.transactionId);
  writeTransactions(transactions.filter((entry) => entry.id !== params.transactionId));
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
  return updated;
}

function deleteBudgetLine({ params }: RouteContext): null {
  const lines = readBudgetLines();
  const existing = lines.find((entry) => entry.id === params.lineId);
  if (!existing) throw new LocalApiError(404, `No budget line with id "${params.lineId}"`);
  writeBudgetLines(lines.filter((entry) => entry.id !== params.lineId));
  return null;
}

interface Route {
  method: HttpMethod;
  /** Path split on `/`; a `:name` segment captures into `params`. */
  segments: string[];
  handler: RouteHandler;
}

function route(method: HttpMethod, path: string, handler: RouteHandler): Route {
  return { method, segments: toSegments(path), handler };
}

const ROUTES: Route[] = [
  route('GET', '/members', listMembers),
  route('GET', '/members/:memberId', getMember),
  route('GET', '/members/:memberId/history', getMemberHistory),
  route('GET', '/members/:memberId/stats', getMemberStats),
  route('POST', '/members/:memberId/pathway', startPathway),
  route('GET', '/meetings', listMeetings),
  route('GET', '/meetings/:meetingId', getMeeting),
  route('POST', '/meetings', createMeeting),
  route('PATCH', '/meetings/:meetingId', updateMeeting),
  route('GET', '/guests', listGuests),
  route('GET', '/guests/:guestId', getGuest),
  route('PATCH', '/guests/:guestId', updateGuest),
  route('DELETE', '/guests/:guestId', deleteGuest),
  route('GET', '/guests/:guestId/contact-logs', listContactLogs),
  route('POST', '/guests/:guestId/contact-logs', createContactLog),
  route('PATCH', '/guests/:guestId/contact-logs/:logId', updateContactLog),
  route('DELETE', '/guests/:guestId/contact-logs/:logId', deleteContactLog),
  route('GET', '/guests/:guestId/visit-logs', listVisitLogs),
  route('POST', '/guests/:guestId/visit-logs', createVisitLog),
  route('PATCH', '/guests/:guestId/visit-logs/:logId', updateVisitLog),
  route('DELETE', '/guests/:guestId/visit-logs/:logId', deleteVisitLog),
  route('GET', '/assets', listAssets),
  route('GET', '/assets/:assetId', getAsset),
  route('POST', '/assets', createAsset),
  route('PATCH', '/assets/:assetId', updateAsset),
  route('DELETE', '/assets/:assetId', deleteAsset),
  route('GET', '/documents', listDocuments),
  route('GET', '/documents/:documentId', getDocument),
  route('POST', '/documents', createDocument),
  route('PATCH', '/documents/:documentId', updateDocument),
  route('DELETE', '/documents/:documentId', deleteDocument),
  route('GET', '/meetings/:meetingId/checklist', listChecklist),
  route('POST', '/meetings/:meetingId/checklist', createChecklistItem),
  route('PATCH', '/meetings/:meetingId/checklist/:itemId', updateChecklistItem),
  route('DELETE', '/meetings/:meetingId/checklist/:itemId', deleteChecklistItem),
  route('GET', '/inventory-items', listInventoryItems),
  route('GET', '/inventory-items/:itemId', getInventoryItem),
  route('POST', '/inventory-items', createInventoryItem),
  route('PATCH', '/inventory-items/:itemId', updateInventoryItem),
  route('DELETE', '/inventory-items/:itemId', deleteInventoryItem),
  route('GET', '/transactions', listTransactions),
  route('GET', '/transactions/:transactionId', getTransaction),
  route('POST', '/transactions', createTransaction),
  route('PATCH', '/transactions/:transactionId', updateTransaction),
  route('DELETE', '/transactions/:transactionId', deleteTransaction),
  route('GET', '/dues-records', listDuesRecords),
  route('PATCH', '/dues-records/:recordId', updateDuesRecord),
  route('GET', '/budget-lines', listBudgetLines),
  route('POST', '/budget-lines', createBudgetLine),
  route('PATCH', '/budget-lines/:lineId', updateBudgetLine),
  route('DELETE', '/budget-lines/:lineId', deleteBudgetLine),
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

/** Resolves a request against the route table. Throws `LocalApiError` for
 * anything a real server would answer with a 4xx. */
export function handleLocalRequest(request: LocalRequest): unknown {
  const method = request.method ?? 'GET';
  const match = matchRoute(method, request.url);
  if (!match) throw new LocalApiError(404, `No local route for ${method} ${request.url}`);

  return match.route.handler({
    params: match.params,
    query: parseQuery(request.url),
    body: request.body,
  });
}
