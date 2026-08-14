import type {
  AhCounterEntry as AhCounterEntryRow,
  Evaluation as EvaluationRow,
  HistoryEvent as HistoryEventRow,
  Membership,
  PlannerRow as PlannerRowRecord,
  SpeechSlotRequest as SpeechSlotRequestRow,
  TimerEntry as TimerEntryRow,
} from '@prisma/client';

import { toWireHistoryEventKind } from './history-mapping';

/** ---------------------------------------------------------- history -- */

/** Wire shape matches the discriminated union in
 * `lib/education/history.ts`. `date` is projected to the `YYYY-MM-DD`
 * prefix — that's what the frontend timeline expects. */
export type HistoryEventWire =
  | { id: string; memberId: string; date: string; type: 'joined' }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'level-reached';
      level: number;
      pathway: string;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'speech-given';
      title: string;
      meetingNumber: number;
      projectName?: string;
      /** Set when this event is derived from a `MeetingSpeaker` row rather
       * than a stored `HistoryEvent` — lets the client join it against
       * `EvaluationSubmission.meetingSpeakerId` to show received feedback
       * under the right speech. */
      meetingSpeakerId?: string;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'project-started';
      projectName: string;
      level: number;
      pathway: string;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'project-completed';
      projectName: string;
      level: number;
      pathway: string;
    }
  | {
      id: string;
      memberId: string;
      date: string;
      type: 'role-taken';
      role: string;
      meetingNumber: number;
    };

export function toHistoryEventWire(row: HistoryEventRow): HistoryEventWire {
  const kind = toWireHistoryEventKind(row.type);
  const base = { id: row.id, memberId: row.membershipId, date: isoDate(row.date) };
  switch (kind) {
    case 'joined':
      return { ...base, type: 'joined' };
    case 'level-reached':
      return {
        ...base,
        type: 'level-reached',
        level: row.level ?? 1,
        pathway: row.pathway ?? '',
      };
    case 'speech-given': {
      const wire: Extract<HistoryEventWire, { type: 'speech-given' }> = {
        ...base,
        type: 'speech-given',
        title: row.title ?? '',
        meetingNumber: row.meetingNumber ?? 0,
      };
      if (row.projectName) wire.projectName = row.projectName;
      return wire;
    }
    case 'project-started':
      return {
        ...base,
        type: 'project-started',
        projectName: row.projectName ?? '',
        level: row.level ?? 1,
        pathway: row.pathway ?? '',
      };
    case 'project-completed':
      return {
        ...base,
        type: 'project-completed',
        projectName: row.projectName ?? '',
        level: row.level ?? 1,
        pathway: row.pathway ?? '',
      };
    case 'role-taken':
      return {
        ...base,
        type: 'role-taken',
        role: row.role ?? '',
        meetingNumber: row.meetingNumber ?? 0,
      };
  }
}

/** Shape a `speechGiven` event derives from — the fields `EducationService`
 * selects off `MeetingSpeaker` (plus its parent meeting) when a delivered
 * speech has no matching `HistoryEvent` row. See `EducationService` for why
 * this projection exists instead of a stored row. */
export interface DeliveredSpeakerRow {
  id: string;
  clubId: string;
  membershipId: string | null;
  title: string;
  project: string | null;
  pathway: string | null;
  updatedAt: Date;
  meeting: { meetingNumber: number; dateTime: Date };
}

export function toSpeechGivenWire(
  speaker: DeliveredSpeakerRow,
): Extract<HistoryEventWire, { type: 'speech-given' }> {
  const wire: Extract<HistoryEventWire, { type: 'speech-given' }> = {
    id: `speech:${speaker.id}`,
    memberId: speaker.membershipId ?? '',
    date: isoDate(speaker.meeting.dateTime),
    type: 'speech-given',
    title: speaker.title,
    meetingNumber: speaker.meeting.meetingNumber,
    meetingSpeakerId: speaker.id,
  };
  if (speaker.project) wire.projectName = speaker.project;
  return wire;
}

export function toSpeechGivenHistoryRow(speaker: DeliveredSpeakerRow): HistoryEventRow {
  return {
    id: `speech:${speaker.id}`,
    clubId: speaker.clubId,
    membershipId: speaker.membershipId ?? '',
    type: 'speechGiven',
    date: speaker.meeting.dateTime,
    meetingNumber: speaker.meeting.meetingNumber,
    role: null,
    title: speaker.title,
    projectName: speaker.project,
    level: null,
    pathway: speaker.pathway,
    createdAt: speaker.updatedAt,
  };
}

/** --------------------------------------------------------- reports -- */

export interface EvaluationWire {
  id: string;
  speechEventId: string;
  memberId: string;
  evaluatorId: string;
  meetingNumber: number;
  date: string;
  strengths: string;
  improvement: string;
  overallRating: 1 | 2 | 3 | 4 | 5;
}

export function toEvaluationWire(row: EvaluationRow): EvaluationWire {
  const rating = clampRating(row.overallRating);
  return {
    id: row.id,
    speechEventId: row.speechEventId,
    memberId: row.membershipId,
    evaluatorId: row.evaluatorMembershipId,
    meetingNumber: row.meetingNumber,
    date: isoDate(row.date),
    strengths: row.strengths,
    improvement: row.improvement,
    overallRating: rating,
  };
}

export interface TimerEntryWire {
  id: string;
  speechEventId: string;
  memberId: string;
  meetingNumber: number;
  date: string;
  targetMinMinutes: number;
  targetMaxMinutes: number;
  actualSeconds: number;
}

export function toTimerEntryWire(row: TimerEntryRow): TimerEntryWire {
  return {
    id: row.id,
    speechEventId: row.speechEventId,
    memberId: row.membershipId,
    meetingNumber: row.meetingNumber,
    date: isoDate(row.date),
    targetMinMinutes: row.targetMinMinutes,
    targetMaxMinutes: row.targetMaxMinutes,
    actualSeconds: row.actualSeconds,
  };
}

export interface AhCounterEntryWire {
  id: string;
  speechEventId: string;
  memberId: string;
  meetingNumber: number;
  date: string;
  fillerCounts: Record<string, number>;
}

export function toAhCounterEntryWire(row: AhCounterEntryRow): AhCounterEntryWire {
  return {
    id: row.id,
    speechEventId: row.speechEventId,
    memberId: row.membershipId,
    meetingNumber: row.meetingNumber,
    date: isoDate(row.date),
    fillerCounts: parseFillerCounts(row.fillerCounts),
  };
}

/** ------------------------------------------------- speech slot req -- */

export interface SpeechSlotRequestWire {
  id: string;
  clubId: string;
  memberId: string;
  meetingId: string;
  projectName?: string;
  note?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt: string;
}

export function toSpeechSlotRequestWire(row: SpeechSlotRequestRow): SpeechSlotRequestWire {
  const wire: SpeechSlotRequestWire = {
    id: row.id,
    clubId: row.clubId,
    memberId: row.membershipId,
    meetingId: row.meetingId,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
  };
  if (row.projectName) wire.projectName = row.projectName;
  if (row.note) wire.note = row.note;
  return wire;
}

/** ----------------------------------------------------- member stats -- */

/** Fields on `Membership` and `HistoryEvent` are enough to compute the
 * `MemberStats` shape the web reads via `computeMemberStats`. The service
 * loads the row + events and returns the derived object. */
export interface MemberStatsWire {
  speechesGiven: number;
  projectsCompleted: number;
  meetingsAttended: number;
  rolesTaken: number;
  joinedAt: string;
  currentProject: {
    name: string;
    level: number;
    pathway: string;
    startedDate: string;
  } | null;
  latestSpeech: {
    title: string;
    date: string;
    meetingNumber: number;
  } | null;
  favouriteRole: {
    role: string;
    count: number;
  } | null;
}

export function computeMemberStats(
  member: Pick<Membership, 'id' | 'createdAt'>,
  events: HistoryEventRow[],
  meetingsAttended: number,
): MemberStatsWire {
  const sorted = [...events].sort((a, b) => {
    const ad = a.date.getTime();
    const bd = b.date.getTime();
    if (ad !== bd) return bd - ad;
    return a.id < b.id ? 1 : -1;
  });

  const completedProjects = new Set<string>();
  for (const e of sorted) {
    if (e.type === 'projectCompleted' && e.projectName) completedProjects.add(e.projectName);
  }

  let currentProject: MemberStatsWire['currentProject'] = null;
  for (const e of sorted) {
    if (e.type !== 'projectStarted') continue;
    if (!e.projectName || completedProjects.has(e.projectName)) continue;
    currentProject = {
      name: e.projectName,
      level: e.level ?? 1,
      pathway: e.pathway ?? '',
      startedDate: isoDate(e.date),
    };
    break;
  }

  let latestSpeech: MemberStatsWire['latestSpeech'] = null;
  for (const e of sorted) {
    if (e.type === 'speechGiven') {
      latestSpeech = {
        title: e.title ?? '',
        date: isoDate(e.date),
        meetingNumber: e.meetingNumber ?? 0,
      };
      break;
    }
  }

  const speechesGiven = sorted.reduce((n, e) => (e.type === 'speechGiven' ? n + 1 : n), 0);

  const roleCounts = new Map<string, number>();
  for (const e of sorted) {
    if (e.type !== 'roleTaken' || !e.role) continue;
    roleCounts.set(e.role, (roleCounts.get(e.role) ?? 0) + 1);
  }
  const rolesTaken = Array.from(roleCounts.values()).reduce((sum, n) => sum + n, 0);
  let favouriteRole: MemberStatsWire['favouriteRole'] = null;
  for (const [role, count] of roleCounts) {
    if (!favouriteRole || count > favouriteRole.count) favouriteRole = { role, count };
  }

  const joinedEvent = sorted.find((e) => e.type === 'joined');
  const joinedAt = joinedEvent ? isoDate(joinedEvent.date) : isoDate(member.createdAt);

  return {
    speechesGiven,
    projectsCompleted: completedProjects.size,
    meetingsAttended,
    rolesTaken,
    joinedAt,
    currentProject,
    latestSpeech,
    favouriteRole,
  };
}

/** ------------------------------------------------------- planner rows -- */

/** Wire shape matches the web `lib/education/planner.ts` `PlannerRow`
 * interface, minus `id` duplication concerns — `assignees` carries the same
 * 13-slot `Record<AssigneeField, Assignee | null>` the frontend already
 * builds, stored and returned as one JSON blob. */
export interface PlannerRowWire {
  id: string;
  meetingNumber: number | null;
  dateTime: string | null;
  theme: string;
  notes: string;
  assignees: Record<string, unknown>;
  meetingId: string | null;
}

export function toPlannerRowWire(row: PlannerRowRecord): PlannerRowWire {
  return {
    id: row.id,
    meetingNumber: row.meetingNumber,
    dateTime: row.dateTime,
    theme: row.theme,
    notes: row.notes,
    assignees: parseAssignees(row.assignees),
    meetingId: row.meetingId,
  };
}

function parseAssignees(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/** ----------------------------------------------------------- helpers -- */

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function clampRating(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as 1 | 2 | 3 | 4 | 5;
}

function parseFillerCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}
