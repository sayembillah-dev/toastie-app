import type { Pathway } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import type { DraftSpeaker } from '@/lib/meetings/draft';
import { getGuestFullName } from '@/lib/people/guests';

/** A prepared speech slot on a meeting — backed by `MeetingSpeaker` on the
 * API, one row per order with no upper bound (the planner's Speaker 1–4
 * columns seed and mirror the first four; any beyond that live on the
 * meeting only). Replaces what used to be pure Redux draft state
 * (`lib/meetings/draft.ts`'s old `DraftSpeaker`), so a slot now survives a
 * page refresh. */

export const SPEAKER_STATUSES = ['requested', 'confirmed', 'delivered'] as const;
export type SpeakerStatus = (typeof SPEAKER_STATUSES)[number];

export interface PreparedSpeakerWire {
  id: string;
  order: number;
  status: SpeakerStatus;
  membershipId: string | null;
  guestId: string | null;
  evaluatorMembershipId: string | null;
  evaluatorGuestId: string | null;
  title: string;
  duration: number | null;
  pathway: string | null;
  project: string | null;
  notes: string | null;
  /** Count of public evaluation submissions received on this speaker's
   * shareable link. */
  evaluationCount: number;
}

/** Every field independently omittable — the tab saves whichever fields
 * changed, not the whole card. */
export interface UpdatePreparedSpeakerInput {
  status?: SpeakerStatus;
  membershipId?: string | null;
  guestId?: string | null;
  evaluatorMembershipId?: string | null;
  evaluatorGuestId?: string | null;
  title?: string;
  duration?: number | null;
  pathway?: string | null;
  project?: string | null;
  notes?: string | null;
}

function resolveAssignee(
  membershipId: string | null,
  guestId: string | null,
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): Assignee | null {
  if (membershipId) return { kind: 'member', memberId: membershipId };
  if (guestId) {
    const guest = guests.find((g) => g.id === guestId);
    return {
      kind: 'guest',
      guestId,
      name: guest ? getGuestFullName(guest) : 'Unknown guest',
    };
  }
  return null;
}

export function speakerAssignee(
  speaker: PreparedSpeakerWire,
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): Assignee | null {
  return resolveAssignee(speaker.membershipId, speaker.guestId, guests);
}

export function evaluatorAssignee(
  speaker: PreparedSpeakerWire,
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): Assignee | null {
  return resolveAssignee(speaker.evaluatorMembershipId, speaker.evaluatorGuestId, guests);
}

/** Converts the API rows into the read-mirror shape `draft.speakers` holds
 * for Overview and the Agenda sheet (see `speakersHydrated`). Guest names
 * are pre-resolved here since those consumers only know how to look member
 * ids up by roster, not guest ids. */
export function toDraftSpeakers(
  speakers: PreparedSpeakerWire[],
  guests: Array<{ id: string; firstName: string; lastName: string }>,
): DraftSpeaker[] {
  const guestName = (guestId: string | null): string | undefined => {
    if (!guestId) return undefined;
    const guest = guests.find((g) => g.id === guestId);
    return guest ? getGuestFullName(guest) : undefined;
  };

  return [...speakers]
    .sort((a, b) => a.order - b.order)
    .map((speaker) => ({
      id: speaker.id,
      status: speaker.status,
      memberId: speaker.membershipId ?? undefined,
      guestId: speaker.guestId ?? undefined,
      speakerName: guestName(speaker.guestId),
      duration: speaker.duration ?? undefined,
      title: speaker.title,
      evaluatorId: speaker.evaluatorMembershipId ?? undefined,
      evaluatorGuestId: speaker.evaluatorGuestId ?? undefined,
      evaluatorName: guestName(speaker.evaluatorGuestId),
      pathway: (speaker.pathway ?? undefined) as Pathway | undefined,
      project: speaker.project ?? undefined,
      notes: speaker.notes ?? undefined,
    }));
}
