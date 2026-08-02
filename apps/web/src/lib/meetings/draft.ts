import type { Pathway } from '@/lib/education/members';

/** The grammarian's word of the day, as captured on the Theme tab. */
export interface WordOfTheDay {
  word: string;
  partOfSpeech?: string;
  meaning: string;
  example: string;
}

export type SpeakerStatus = 'requested' | 'confirmed' | 'delivered';

export interface DraftSpeaker {
  id: string;
  status: SpeakerStatus;
  memberId?: string;
  duration?: number;
  title: string;
  evaluatorId?: string;
  pathway?: Pathway;
  project?: string;
  notes?: string;
  /** Un-saved edits since the last Save — controls the primary CTA state. */
  dirty: boolean;
  /** Accordion state — new cards open expanded so the form is ready to fill. */
  expanded: boolean;
}

/**
 * Everything a meeting's tabs collect between them. Split out of the store so
 * the agenda builder can depend on the shape without reaching into Redux.
 */
export interface MeetingDraft {
  /** Overrides the seeded meeting theme once the Theme tab is filled in. */
  theme: string;
  word: WordOfTheDay;
  /** Role key (see `roles.ts`) → member id. */
  roles: Record<string, string | undefined>;
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
