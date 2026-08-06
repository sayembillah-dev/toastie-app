import type { HistoryEventType as PrismaHistoryEventType } from '@prisma/client';

/** The kebab-case identifiers the web uses in `lib/education/history.ts`. */
export const HISTORY_EVENT_KINDS = [
  'joined',
  'level-reached',
  'speech-given',
  'project-started',
  'project-completed',
  'role-taken',
] as const;

export type HistoryEventKind = (typeof HISTORY_EVENT_KINDS)[number];

/** Prisma enum identifiers cannot contain hyphens, so the DB stores the
 * camelCase form and the serializer maps to/from kebab-case at the wire
 * boundary. */
const WIRE_TO_PRISMA: Record<HistoryEventKind, PrismaHistoryEventType> = {
  joined: 'joined',
  'level-reached': 'levelReached',
  'speech-given': 'speechGiven',
  'project-started': 'projectStarted',
  'project-completed': 'projectCompleted',
  'role-taken': 'roleTaken',
};

const PRISMA_TO_WIRE: Record<PrismaHistoryEventType, HistoryEventKind> = {
  joined: 'joined',
  levelReached: 'level-reached',
  speechGiven: 'speech-given',
  projectStarted: 'project-started',
  projectCompleted: 'project-completed',
  roleTaken: 'role-taken',
};

export function toPrismaHistoryEventType(kind: HistoryEventKind): PrismaHistoryEventType {
  return WIRE_TO_PRISMA[kind];
}

export function toWireHistoryEventKind(type: PrismaHistoryEventType): HistoryEventKind {
  return PRISMA_TO_WIRE[type];
}

export function isHistoryEventKind(value: unknown): value is HistoryEventKind {
  return typeof value === 'string' && (HISTORY_EVENT_KINDS as readonly string[]).includes(value);
}
