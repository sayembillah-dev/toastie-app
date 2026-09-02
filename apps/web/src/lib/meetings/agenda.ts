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

/** Who a person cell actually refers to, when the draft holds roster ids —
 * the on-screen sheet turns each into a bio popover trigger. Purely additive
 * to `person`: the string stays the single source for the printed sheet, the
 * PDF, and the public agenda, none of which render `people` at all. */
export interface AgendaPerson {
  name: string;
  memberId?: string;
  guestId?: string;
}

/** A sub-row under an agenda block: indented, no clock time of its own. */
export interface AgendaLine {
  /** Stable across rebuilds — labels repeat once there is more than one speaker,
   * so they cannot double as React keys. */
  key: string;
  label: string;
  person?: string;
  /** Identities behind `person`, in the same order, when every name resolves
   * to a roster member or guest. A name-joined cell (the evaluators line)
   * carries one entry per name. */
  people?: AgendaPerson[];
  minutes?: number;
  /** Renders italic and grey — used for the pathway/project note under a speech. */
  meta?: boolean;
}

export interface AgendaBlock {
  title: string;
  person?: string;
  /** Identities behind `person` — see `AgendaLine.people`. */
  people?: AgendaPerson[];
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

/** A role holder as an `AgendaPerson` — undefined when the role is unfilled
 * or holds a typed-name guest with no roster row to resolve a bio from
 * (`guestId` is absent for those; see `toRoleHolderMap`). Exported so the
 * sheet's rail can reuse it for the role list it renders straight from the
 * draft. */
export function holderPerson(
  nameOf: NameResolver,
  holder: RoleHolder | undefined,
): AgendaPerson | undefined {
  if (!holder || (!holder.memberId && !holder.guestId)) return undefined;
  const name = holderName(nameOf, holder);
  /* A member id whose roster row is gone resolves to a blank name — no
   * popover on an empty string; the cell falls back to its plain-text rule. */
  if (!name) return undefined;
  return { name, memberId: holder.memberId, guestId: holder.guestId };
}

/** One slot of a speech (speaker or evaluator) as an `AgendaPerson` — the
 * member/guest pair of `DraftSpeaker`. Undefined when the slot is empty or
 * the resolved name is blank (a since-removed member id), so the cell falls
 * back to plain text exactly as it does today. Exported for the rail, which
 * lists speakers and evaluators straight from the draft. */
export function speechSlotPerson(
  nameOf: NameResolver,
  memberId: string | undefined,
  guestId: string | undefined,
  guestName: string | undefined,
): AgendaPerson | undefined {
  if (!memberId && !guestId) return undefined;
  const name = speakerPerson(nameOf, memberId, guestName);
  if (!name) return undefined;
  return { name, memberId, guestId };
}

/** Collects the defined entries, returning undefined when none are — keeps
 * `people` absent (rather than an empty array) on plain-text cells. */
function toPeople(...entries: Array<AgendaPerson | undefined>): AgendaPerson[] | undefined {
  const people = entries.filter((entry): entry is AgendaPerson => !!entry);
  return people.length > 0 ? people : undefined;
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
      people: toPeople(
        speechSlotPerson(
          nameOf,
          speaker.evaluatorId,
          speaker.evaluatorGuestId,
          speaker.evaluatorName,
        ),
      ),
      minutes: 2,
    });
    lines.push({
      key: `${speaker.id}-speech`,
      label: `${index + 1}. ${speaker.title.trim() || 'Speech title to be confirmed'}`,
      person: speakerPerson(nameOf, speaker.memberId, speaker.speakerName),
      people: toPeople(
        speechSlotPerson(nameOf, speaker.memberId, speaker.guestId, speaker.speakerName),
      ),
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
  const harkmaster = holderName(nameOf, roles.harkmaster);

  /* Every speech evaluator named once, in the order the speakers were added.
   * Deduped on the resolved name (same rule as before), with the identity
   * kept alongside so the sheet can offer each name's bio popover. */
  const evaluatorPeople: AgendaPerson[] = [];
  for (const speaker of draft.speakers) {
    const entry = speechSlotPerson(
      nameOf,
      speaker.evaluatorId,
      speaker.evaluatorGuestId,
      speaker.evaluatorName,
    );
    if (entry && !evaluatorPeople.some((seen) => seen.name === entry.name)) {
      evaluatorPeople.push(entry);
    }
  }
  const speechEvaluators = evaluatorPeople.map((entry) => entry.name).join(', ');

  const blocks: AgendaBlock[] = [
    {
      title: 'Sergeant at Arms opens the floor',
      person: holderName(nameOf, roles['sergeant-at-arms']),
      people: toPeople(holderPerson(nameOf, roles['sergeant-at-arms'])),
      minutes: 10,
      lines: [
        { key: 'ground-rules', label: 'Ground rules' },
        { key: 'mission-statement', label: 'Mission Statement' },
      ],
    },
    {
      title: 'Presiding Officer calls the Meeting to order',
      person: president,
      people: toPeople(holderPerson(nameOf, roles.president)),
      minutes: 0,
      lines: [
        { key: 'anthem', label: 'National Anthem', minutes: 5 },
        { key: 'welcome', label: 'Welcome guests & Round-Roaming Session', minutes: 5 },
      ],
    },
    {
      title: `Introduction of the ${getToastmasterLabel(meeting.dateTime)}`,
      person: holderName(nameOf, roles.toastmaster),
      people: toPeople(holderPerson(nameOf, roles.toastmaster)),
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
      people: toPeople(holderPerson(nameOf, roles['general-evaluator'])),
      minutes: 10,
      lines: [
        {
          key: 'ah-counter',
          label: 'Ah Counter',
          person: ahCounter,
          people: toPeople(holderPerson(nameOf, roles['ah-counter'])),
        },
        {
          key: 'timer',
          label: 'Timer',
          person: timer,
          people: toPeople(holderPerson(nameOf, roles.timer)),
        },
        {
          key: 'grammarian',
          label: 'Grammarian',
          person: grammarian,
          people: toPeople(holderPerson(nameOf, roles.grammarian)),
        },
      ],
    },
    buildPreparedSpeechBlock(draft, nameOf),
    {
      title: `${tm} introduces the Table Topic Master`,
      person: holderName(nameOf, roles['table-topic-master']),
      people: toPeople(holderPerson(nameOf, roles['table-topic-master'])),
      minutes: 2,
      lines: [{ key: 'table-topic-session', label: 'Table Topic Session', minutes: 15 }],
    },
    {
      title: `${tm} invites General Evaluator`,
      person: generalEvaluator,
      people: toPeople(holderPerson(nameOf, roles['general-evaluator'])),
      minutes: 0,
      lines: [
        {
          key: 'speech-evaluations',
          label: 'Prepared Speech Evaluations',
          person: speechEvaluators,
          people: toPeople(...evaluatorPeople),
          minutes: 10,
        },
        {
          key: 'table-topic-evaluations',
          label: 'Table Topic Speech Evaluations',
          person: holderName(nameOf, roles['table-topic-evaluator']),
          people: toPeople(holderPerson(nameOf, roles['table-topic-evaluator'])),
          minutes: 10,
        },
        {
          key: 'ah-counter-report',
          label: "Ah Counter's Report",
          person: ahCounter,
          people: toPeople(holderPerson(nameOf, roles['ah-counter'])),
          minutes: 2,
        },
        {
          key: 'timer-report',
          label: "Timer's Report",
          person: timer,
          people: toPeople(holderPerson(nameOf, roles.timer)),
          minutes: 2,
        },
        {
          key: 'grammarian-report',
          label: "Grammarian's Report",
          person: grammarian,
          people: toPeople(holderPerson(nameOf, roles.grammarian)),
          minutes: 2,
        },
      ],
    },
    {
      title: `${tm} invites Presiding Officer`,
      person: president,
      people: toPeople(holderPerson(nameOf, roles.president)),
      minutes: 2,
      lines: [{ key: 'feedback', label: 'Feedback & Q&A', minutes: 4 }],
    },
    /* Optional closing segment — only on the agenda when a Harkmaster is
     * actually assigned, so meetings without one keep their usual run of
     * show and timings. */
    ...(harkmaster
      ? [
          {
            title: `${tm} invites the Harkmaster`,
            person: harkmaster,
            people: toPeople(holderPerson(nameOf, roles.harkmaster)),
            minutes: 0,
            lines: [
              {
                key: 'harkmaster-quiz',
                label: 'Harkmaster quizzes the audience on the meeting',
                minutes: 5,
              },
            ],
          },
        ]
      : []),
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
