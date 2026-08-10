import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { DraftSpeaker, MeetingDraft, RoleHolder, WordOfTheDay } from '@/lib/meetings/draft';
import { EMPTY_DRAFT } from '@/lib/meetings/draft';

/**
 * Working state for the meeting detail screen. Every tab writes here instead of
 * holding its own `useState`, which is what lets the Agenda preview render the
 * theme, roles and speakers the other tabs collected.
 *
 * Keyed by meeting id: the store outlives a route change, so a single shared
 * draft would leak one meeting's roles into the next one opened.
 */
export interface MeetingDraftState {
  byMeetingId: Record<string, MeetingDraft>;
  /** Meetings whose draft has already been filled from the saved record.
   * Kept beside the drafts rather than inside one so re-opening the Theme
   * tab cannot overwrite edits the user has not committed yet. */
  hydratedIds: Record<string, true>;
}

const initialState: MeetingDraftState = { byMeetingId: {}, hydratedIds: {} };

/** Drafts are created lazily — a meeting only gets an entry once it is edited. */
function ensureDraft(state: MeetingDraftState, meetingId: string): MeetingDraft {
  let draft = state.byMeetingId[meetingId];
  if (!draft) {
    draft = structuredClone(EMPTY_DRAFT);
    state.byMeetingId[meetingId] = draft;
  }
  return draft;
}

interface MeetingScoped {
  meetingId: string;
}

export const meetingDraftSlice = createSlice({
  name: 'meetingDraft',
  initialState,
  reducers: {
    /** Seeds theme + word from the saved meeting the first time its Theme
     * tab renders. Without this the tab opens blank over a record that has
     * values, which reads as "my save was lost". Runs once per meeting —
     * later renders (tab switches, refetches) are no-ops, so in-flight
     * edits survive. */
    draftHydrated(
      state,
      action: PayloadAction<MeetingScoped & { theme: string; word?: WordOfTheDay }>,
    ) {
      const { meetingId, theme, word } = action.payload;
      if (state.hydratedIds[meetingId]) return;
      const draft = ensureDraft(state, meetingId);
      draft.theme = theme;
      if (word) draft.word = { ...word };
      state.hydratedIds[meetingId] = true;
    },
    themeChanged(state, action: PayloadAction<MeetingScoped & { theme: string }>) {
      ensureDraft(state, action.payload.meetingId).theme = action.payload.theme;
    },
    wordChanged(state, action: PayloadAction<MeetingScoped & { patch: Partial<WordOfTheDay> }>) {
      const draft = ensureDraft(state, action.payload.meetingId);
      draft.word = { ...draft.word, ...action.payload.patch };
    },
    /** Mirrors the persisted `MeetingRoleAssignment` rows into the draft
     * whenever the Roles query resolves — dispatched from the meeting page
     * shell, the same way `draftHydrated` seeds theme/word, so Overview and
     * the Agenda sheet stay correct even for a tab the user hasn't opened.
     * Unlike theme/word there's no "unsaved edit" to protect: every role
     * pick already round-trips through the API, so a fresh fetch always
     * wins. */
    rolesHydrated(
      state,
      action: PayloadAction<MeetingScoped & { roles: Record<string, RoleHolder | undefined> }>,
    ) {
      ensureDraft(state, action.payload.meetingId).roles = { ...action.payload.roles };
    },
    /** Mirrors the persisted `MeetingSpeaker` rows into the draft whenever the
     * Prepared Speakers query resolves — same read-through pattern as
     * `rolesHydrated`. The tab itself writes straight through the API; this
     * is only what Overview and the Agenda sheet read. */
    speakersHydrated(state, action: PayloadAction<MeetingScoped & { speakers: DraftSpeaker[] }>) {
      ensureDraft(state, action.payload.meetingId).speakers = action.payload.speakers;
    },
  },
  selectors: {
    /* Falls back to the shared blank draft so consumers never branch on
     * "has this meeting been touched yet". */
    selectMeetingDraft: (state, meetingId: string): MeetingDraft =>
      state.byMeetingId[meetingId] ?? EMPTY_DRAFT,
  },
});

export const { draftHydrated, themeChanged, wordChanged, rolesHydrated, speakersHydrated } =
  meetingDraftSlice.actions;

export const { selectMeetingDraft } = meetingDraftSlice.selectors;
