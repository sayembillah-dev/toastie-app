import type { Member, Pathway } from '@/lib/education/members';
import { getProjectDuration } from '@/lib/education/pathways';
import type { Guest } from '@/lib/people/guests';
import { getGuestFullName } from '@/lib/people/guests';
import type { SpeakerKind } from './draft';
import type { PreparedSpeakerWire } from './prepared-speakers';
import type { RoleAssignment } from './role-assignments';

export type AgendaSpeakerRole = 'speaker' | 'evaluator' | 'general-evaluator' | 'tt-evaluator';

/** One person the agenda already knows about — a prepared speaker, their
 * evaluator, the General Evaluator, or the Table Topics Evaluator. Table
 * Topics speakers are deliberately absent: they aren't predefined anywhere
 * on the agenda, so "Take from agenda" has nothing to pull for them. */
export interface AgendaSpeakerSource {
  /** Stable across rebuilds — lets a second "Take from agenda" click find
   * and update the row it created last time instead of duplicating it. */
  agendaKey: string;
  memberId?: string;
  guestId?: string;
  name: string;
  role: AgendaSpeakerRole;
  /** The parent slot's kind — `keynote` only ever appears on
   * `role: 'speaker'` entries, since a keynote carries no evaluator. The
   * Timer reads it to label the row and time it off the hand-entered
   * duration rather than a Pathways project. */
  kind: SpeakerKind;
  /** Only set for `role: 'speaker'` — a prepared speech's project range
   * (the 5–7 min default until a project is picked), or a keynote's
   * hand-entered duration plus a short overrun (absent until one is
   * entered). */
  durationBounds?: { min: number; max: number };
}

/** Minutes a keynote may run past its entered time before the red light —
 * the single hand-set duration has no Pathways range to borrow, so green
 * lands on the duration itself and red this far past it. */
const KEYNOTE_OVERRUN_MINUTES = 2;

/** Timed range for a `role: 'speaker'` source. A prepared speech borrows
 * its project's range; a keynote derives one from its manual duration —
 * undefined while none is entered, leaving the timer on its type default. */
function speakerDurationBounds(speaker: {
  kind: SpeakerKind;
  duration?: number | null;
  project?: string | null;
  pathway?: string | null;
}): { min: number; max: number } | undefined {
  if (speaker.kind !== 'keynote') {
    return getProjectDuration(
      speaker.project ?? undefined,
      (speaker.pathway ?? undefined) as Pathway | undefined,
    );
  }
  if (speaker.duration == null) return undefined;
  return { min: speaker.duration, max: speaker.duration + KEYNOTE_OVERRUN_MINUTES };
}

function personName(
  membershipId: string | null,
  guestId: string | null,
  members: Member[],
  guests: Guest[],
): { memberId?: string; guestId?: string; name: string } | undefined {
  if (membershipId) {
    const member = members.find((m) => m.id === membershipId);
    return {
      memberId: membershipId,
      name: member ? getGuestFullName(member) : 'Unknown member',
    };
  }
  if (guestId) {
    const guest = guests.find((g) => g.id === guestId);
    return { guestId, name: guest ? getGuestFullName(guest) : 'Unknown guest' };
  }
  return undefined;
}

/** Everyone the agenda has assigned who a filler-counter or timer would
 * plausibly need to track: each prepared speaker and their evaluator, plus
 * whoever holds the General Evaluator and Table Topics Evaluator roles. */
export function buildAgendaSpeakerSources(
  preparedSpeakers: PreparedSpeakerWire[],
  roleRows: RoleAssignment[],
  members: Member[],
  guests: Guest[],
): AgendaSpeakerSource[] {
  const sources: AgendaSpeakerSource[] = [];

  for (const speaker of [...preparedSpeakers].sort((a, b) => a.order - b.order)) {
    const speakerPerson = personName(speaker.membershipId, speaker.guestId, members, guests);
    if (speakerPerson) {
      sources.push({
        agendaKey: `speaker:${speaker.id}`,
        ...speakerPerson,
        role: 'speaker',
        kind: speaker.kind,
        durationBounds: speakerDurationBounds(speaker),
      });
    }

    const evaluatorPerson = personName(
      speaker.evaluatorMembershipId,
      speaker.evaluatorGuestId,
      members,
      guests,
    );
    if (evaluatorPerson) {
      sources.push({
        agendaKey: `speaker-evaluator:${speaker.id}`,
        ...evaluatorPerson,
        role: 'evaluator',
        kind: speaker.kind,
      });
    }
  }

  const roleRow = (roleKey: string) => roleRows.find((row) => row.roleKey === roleKey);

  const generalEvaluator = roleRow('general-evaluator');
  if (generalEvaluator) {
    const person = personName(
      generalEvaluator.membershipId,
      generalEvaluator.guestId,
      members,
      guests,
    );
    if (person)
      sources.push({
        agendaKey: 'role:general-evaluator',
        ...person,
        role: 'general-evaluator',
        kind: 'prepared',
      });
  }

  const tableTopicEvaluator = roleRow('table-topic-evaluator');
  if (tableTopicEvaluator) {
    const person = personName(
      tableTopicEvaluator.membershipId,
      tableTopicEvaluator.guestId,
      members,
      guests,
    );
    if (person)
      sources.push({
        agendaKey: 'role:table-topic-evaluator',
        ...person,
        role: 'tt-evaluator',
        kind: 'prepared',
      });
  }

  return sources;
}

/** Wire shape from `GET /public/meetings/:id/roles/agenda-speakers` — the
 * server-computed equivalent of `buildAgendaSpeakerSources` for callers who
 * can't reach `/members`, `/guests`, or the authenticated roles/prepared-
 * speakers endpoints (i.e. an anonymous public-page visitor). */
export interface PublicAgendaSpeakerSource {
  agendaKey: string;
  name: string;
  role: AgendaSpeakerRole;
  /** The parent slot's kind — `keynote` only on `role: 'speaker'` entries. */
  kind: SpeakerKind;
  /** The slot's hand-entered time — read for keynotes, which have no
   * Pathways project to derive a timed range from; otherwise null. */
  duration: number | null;
  project: string | null;
  pathway: string | null;
}

/** Adapts the public wire shape into the same `AgendaSpeakerSource[]` the
 * authenticated tab builds via `buildAgendaSpeakerSources`, so "Take from
 * agenda" produces an identical roster regardless of which surface
 * triggered it — `memberId`/`guestId` are simply absent (optional on
 * `AgendaSpeakerSource`), since a public caller has no roster access and
 * doesn't need them: agendaKey alone drives the merge-vs-create logic in
 * each tool's `handleTakeFromAgenda`. */
export function fromPublicAgendaSpeakerSources(
  sources: PublicAgendaSpeakerSource[],
): AgendaSpeakerSource[] {
  return sources.map((source) => ({
    agendaKey: source.agendaKey,
    name: source.name,
    role: source.role,
    kind: source.kind,
    durationBounds: source.role === 'speaker' ? speakerDurationBounds(source) : undefined,
  }));
}
