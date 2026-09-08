import type { Pathway } from '@/lib/education/members';

/** The grammarian's word of the day, as captured on the Theme tab. */
export interface WordOfTheDay {
  word: string;
  partOfSpeech?: string;
  meaning: string;
  example: string;
}

export type SpeakerStatus = 'requested' | 'confirmed' | 'delivered';

/** `prepared` — the classic evaluated Pathways speech; `keynote` — an
 * unevaluated address carrying only a title, a speaker and a manual
 * `duration` (no evaluator, no pathway/project, no evaluation submissions).
 * Fixed when the slot is created. */
export type SpeakerKind = 'prepared' | 'keynote';

/** Who holds a meeting role (see `draft.roles`) — a member resolves through
 * the roster via `nameOf`; a guest carries its own pre-resolved `name`
 * instead, the same split `DraftSpeaker` uses for a guest speaker/evaluator,
 * since a guest has no roster lookup a plain id could drive. */
export interface RoleHolder {
  memberId?: string;
  guestId?: string;
  name?: string;
}

/** A read-mirror of the API-persisted `MeetingSpeaker` rows (see
 * `lib/meetings/prepared-speakers.ts`) — populated by `speakersHydrated`,
 * the same way `draft.roles` mirrors `MeetingRoleAssignment`. The Prepared
 * Speakers tab itself writes straight through the API, not this slice;
 * everything else that only *reads* the speaker lineup (Overview, the
 * Agenda sheet) keeps reading here.
 *
 * `memberId`/`evaluatorId` are set only when a member holds the slot — a
 * guest holds it instead via `guestId`/`evaluatorGuestId`, with the display
 * name pre-resolved into `speakerName`/`evaluatorName` since a guest has no
 * roster lookup a plain id could drive the way `nameOf(memberId)` does. */
export interface DraftSpeaker {
  id: string;
  /** See `SpeakerKind` — a keynote renders without an evaluator and without
   * pathway/project context wherever the lineup is read. */
  kind: SpeakerKind;
  status: SpeakerStatus;
  memberId?: string;
  guestId?: string;
  speakerName?: string;
  duration?: number;
  title: string;
  evaluatorId?: string;
  evaluatorGuestId?: string;
  evaluatorName?: string;
  pathway?: Pathway;
  project?: string;
  notes?: string;
}

/**
 * Everything a meeting's tabs collect between them. Split out of the store so
 * the agenda builder can depend on the shape without reaching into Redux.
 */
export interface MeetingDraft {
  /** Overrides the seeded meeting theme once the Theme tab is filled in. */
  theme: string;
  word: WordOfTheDay;
  /** Role key (see `roles.ts`) → who holds it. */
  roles: Record<string, RoleHolder | undefined>;
  speakers: DraftSpeaker[];
}

/** Shared blank draft. A module constant rather than a factory so selectors can
 * hand back the same reference for untouched meetings and never re-render. */
export const EMPTY_DRAFT: MeetingDraft = {
  theme: '',
  word: { word: '', meaning: '', example: '' },
  roles: {},
  speakers: [],
};
