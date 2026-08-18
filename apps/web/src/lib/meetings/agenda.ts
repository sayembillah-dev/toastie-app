import { findProject, getProjectDuration } from '@/lib/education/pathways';

import type { MeetingDraft, RoleHolder } from './draft';
import type { Meeting } from './meetings';
import { getToastmasterAbbrev, getToastmasterLabel } from './roles';

/** Agenda header identity. `name`/org lineage are only the loading-state
 * fallback — the live values come from the club profile (`useGetClubProfileQuery`
 * in agenda-preview). `mission` is the standard Toastmasters club mission and
 * still prints from here. */
export const CLUB = {
  name: 'Nifty Toastmasters Club',
  district: '124',
  division: 'B',
  area: 'B07',
  mission:
    'We provide a supportive and positive learning experience in which members are empowered to develop communication and leadership skills, resulting in greater self-confidence and personal growth.',
} as const;

/** A sub-row under an agenda block: indented, no clock time of its own. */
export interface AgendaLine {
  /** Stable across rebuilds — labels repeat once there is more than one speaker,
   * so they cannot double as React keys. */
  key: string;
  label: string;
  person?: string;
  minutes?: number;
  /** Renders italic and grey — used for the pathway/project note under a speech. */
  meta?: boolean;
}

export interface AgendaBlock {
  title: string;
  person?: string;
  /** Minutes belonging to the block itself, on top of whatever its lines take. */
  minutes: number;
  lines: AgendaLine[];
}

export interface AgendaRow extends AgendaBlock {
  /** Clock time the block starts at, accumulated from the meeting's start. */
  startsAt: Date;
  /** What the Min column shows: the block's own minutes, or — when the block is
   * just a container — the roll-up of its lines. Undefined when nothing is set. */
  displayMinutes?: number;
}

/** Resolves a member id to a display name. Supplied by the caller so this module
 * stays free of data-fetching concerns. */
export type NameResolver = (memberId: string | undefined) => string;

function speechMinutes(duration: number | undefined, project: string | undefined): number {
  return duration ?? getProjectDuration(project).min;
}

/** A speech slot's speaker/evaluator resolve through the roster when a
 * member holds it; a guest carries its own pre-resolved name instead (see
 * `toDraftSpeakers`), since `nameOf` only knows how to look member ids up.
 * Exported so the printed agenda sheet (`agenda-preview.tsx`) can apply the
 * same rule outside `buildAgenda`. */
export function speakerPerson(
  nameOf: NameResolver,
  memberId: string | undefined,
  guestName: string | undefined,
): string {
  return memberId ? nameOf(memberId) : (guestName ?? '');
}

/** Same idea as `speakerPerson`, for a meeting role: a member resolves
 * through the roster, a guest reads its pre-resolved `name` (see
 * `toRoleHolderMap`). Exported for the same reason as `speakerPerson`. */
export function holderName(nameOf: NameResolver, holder: RoleHolder | undefined): string {
  if (!holder) return '';
  return holder.memberId ? nameOf(holder.memberId) : (holder.name ?? '');
}

/** Pathway · level · project, matching the italic note under each speech title. */
function speechMeta(pathway?: string, project?: string, level?: number): string {
  return [pathway, level ? String(level) : undefined, project ? `Project: ${project}` : undefined]
    .filter(Boolean)
    .join('  ·  ');
}

function buildPreparedSpeechBlock(draft: MeetingDraft, nameOf: NameResolver): AgendaBlock {
  const lines: AgendaLine[] = [];

  draft.speakers.forEach((speaker, index) => {
    lines.push({
      key: `${speaker.id}-objectives`,
      label: 'Evaluator explains Objectives',
      person: speakerPerson(nameOf, speaker.evaluatorId, speaker.evaluatorName),
      minutes: 2,
    });
    lines.push({
      key: `${speaker.id}-speech`,
      label: `${index + 1}. ${speaker.title.trim() || 'Speech title to be confirmed'}`,
      person: speakerPerson(nameOf, speaker.memberId, speaker.speakerName),
      minutes: speechMinutes(speaker.duration, speaker.project),
    });

    const level = speaker.project ? findProject(speaker.project)?.level : undefined;
    const meta = speechMeta(speaker.pathway, speaker.project, level);
    if (meta) lines.push({ key: `${speaker.id}-meta`, label: meta, meta: true });
  });

  if (lines.length === 0) {
    lines.push({ key: 'no-speakers', label: 'No prepared speakers added yet', meta: true });
  }

  return { title: 'Prepared Speech Session', minutes: 0, lines };
}

/**
 * The club's standard run-of-show, filled in from the meeting's draft.
 *
 * Timing rule, taken from the printed agenda: a block advances the clock by its
 * own minutes plus every minute its lines claim, and the Min column shows the
 * block's own minutes — or the roll-up when the block contributes none itself.
 */
export function buildAgenda(
  meeting: Meeting,
  draft: MeetingDraft,
  nameOf: NameResolver,
): AgendaRow[] {
  const { roles } = draft;
  const tm = getToastmasterAbbrev(meeting.dateTime);

  const president = holderName(nameOf, roles.president);
  const generalEvaluator = holderName(nameOf, roles['general-evaluator']);
  const ahCounter = holderName(nameOf, roles['ah-counter']);
  const timer = holderName(nameOf, roles.timer);
  const grammarian = holderName(nameOf, roles.grammarian);

  /* Every speech evaluator named once, in the order the speakers were added. */
  const speechEvaluators = [
    ...new Set(
      draft.speakers
        .map((speaker) => speakerPerson(nameOf, speaker.evaluatorId, speaker.evaluatorName))
        .filter(Boolean),
    ),
  ].join(', ');

  const blocks: AgendaBlock[] = [
    {
      title: 'Sergeant at Arms opens the floor',
      person: holderName(nameOf, roles['sergeant-at-arms']),
      minutes: 10,
      lines: [
        { key: 'ground-rules', label: 'Ground rules' },
        { key: 'mission-statement', label: 'Mission Statement' },
      ],
    },
    {
      title: 'Presiding Officer calls the Meeting to order',
      person: president,
      minutes: 0,
      lines: [
        { key: 'anthem', label: 'National Anthem', minutes: 5 },
        { key: 'welcome', label: 'Welcome guests & Round-Roaming Session', minutes: 5 },
      ],
    },
    {
      title: `Introduction of the ${getToastmasterLabel(meeting.dateTime)}`,
      person: holderName(nameOf, roles.toastmaster),
      minutes: 1,
      lines: [],
    },
    {
      title: `${tm} introduces the Theme of the day`,
      minutes: 2,
      lines: [],
    },
    {
      title: `${tm} introduces the General Evaluator`,
      person: generalEvaluator,
      minutes: 10,
      lines: [
        { key: 'ah-counter', label: 'Ah Counter', person: ahCounter },
        { key: 'timer', label: 'Timer', person: timer },
        { key: 'grammarian', label: 'Grammarian', person: grammarian },
      ],
    },
    buildPreparedSpeechBlock(draft, nameOf),
    {
      title: `${tm} introduces the Table Topic Master`,
      person: holderName(nameOf, roles['table-topic-master']),
      minutes: 2,
      lines: [{ key: 'table-topic-session', label: 'Table Topic Session', minutes: 15 }],
    },
    {
      title: `${tm} invites General Evaluator`,
      person: generalEvaluator,
      minutes: 0,
      lines: [
        {
          key: 'speech-evaluations',
          label: 'Prepared Speech Evaluations',
          person: speechEvaluators,
          minutes: 10,
        },
        {
          key: 'table-topic-evaluations',
          label: 'Table Topic Speech Evaluations',
          person: holderName(nameOf, roles['table-topic-evaluator']),
          minutes: 10,
        },
        { key: 'ah-counter-report', label: "Ah Counter's Report", person: ahCounter, minutes: 2 },
        { key: 'timer-report', label: "Timer's Report", person: timer, minutes: 2 },
        { key: 'grammarian-report', label: "Grammarian's Report", person: grammarian, minutes: 2 },
      ],
    },
    {
      title: `${tm} invites Presiding Officer`,
      person: president,
      minutes: 2,
      lines: [{ key: 'feedback', label: 'Feedback & Q&A', minutes: 4 }],
    },
    { title: 'Meeting Conclusion', minutes: 0, lines: [] },
  ];

  let cursor = new Date(meeting.dateTime).getTime();

  return blocks.map((block) => {
    const lineMinutes = block.lines.reduce((total, line) => total + (line.minutes ?? 0), 0);
    const total = block.minutes + lineMinutes;
    const startsAt = new Date(cursor);
    cursor += total * 60_000;

    return {
      ...block,
      startsAt,
      displayMinutes: block.minutes || lineMinutes || undefined,
    };
  });
}
