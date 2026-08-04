import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import { computeMemberStats, sortEvents } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import { findProject } from '@/lib/education/pathways';
import type { CreateMeetingInput, Meeting, UpdateMeetingInput } from '@/lib/meetings/meetings';
import { MEETING_STATUSES } from '@/lib/meetings/meetings';
import type { Guest, GuestStage } from '@/lib/people/guests';
import { isGuestStage } from '@/lib/people/guests';

import {
  readExtrasFor,
  readGuests,
  readHistoryEvents,
  readMeetings,
  readMembers,
  writeGuests,
  writeHistoryEvents,
  writeMeetings,
  writeMembers,
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

/** The board only ever sends a stage, so an unknown one is the only way this
 * call can go wrong — and it has to 400 rather than write a column nobody
 * renders. */
function parseUpdateGuestBody(body: unknown): { stage: GuestStage } {
  if (typeof body !== 'object' || body === null) {
    throw new LocalApiError(400, 'Expected an update-guest body');
  }

  const { stage } = body as { stage?: unknown };
  if (!isGuestStage(stage)) {
    throw new LocalApiError(400, `"${String(stage)}" is not a guest stage`);
  }

  return { stage };
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
function updateMeeting({ params, body }: RouteContext): Meeting {
  const existing = getMeeting({ params, body });
  const updated: Meeting = { ...existing, ...parseUpdateMeetingBody(body) };
  writeMeetings(readMeetings().map((entry) => (entry.id === existing.id ? updated : entry)));
  return updated;
}

function listGuests(): Guest[] {
  return readGuests();
}

/** Backs both the Kanban drag-and-drop and the mobile stage dropdown — moving a
 * card is the same single-field write either way. */
function updateGuest({ params, body }: RouteContext): Guest {
  const guests = readGuests();
  const existing = guests.find((entry) => entry.id === params.guestId);
  if (!existing) throw new LocalApiError(404, `No guest with id "${params.guestId}"`);

  const updated: Guest = { ...existing, ...parseUpdateGuestBody(body) };
  writeGuests(guests.map((entry) => (entry.id === updated.id ? updated : entry)));
  return updated;
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
  route('PATCH', '/guests/:guestId', updateGuest),
];

function toSegments(path: string): string[] {
  return path.split('?')[0].split('/').filter(Boolean);
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

  return match.route.handler({ params: match.params, body: request.body });
}
