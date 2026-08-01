import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import { computeMemberStats, sortEvents } from '@/lib/education/history';
import type { Member, StartPathwayInput } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import { findProject } from '@/lib/education/pathways';

import {
  readExtrasFor,
  readHistoryEvents,
  readMembers,
  writeHistoryEvents,
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

  const definition = project ? findProject(project) : undefined;
  if (!definition) {
    throw new LocalApiError(400, `"${String(project)}" is not a project in the catalog`);
  }
  if (level !== definition.level) {
    throw new LocalApiError(400, `"${definition.name}" is a level ${definition.level} project`);
  }

  return { pathway, project: definition.name, level: definition.level };
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
