import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice, nanoid } from '@reduxjs/toolkit';

import type { DraftSpeaker, MeetingDraft, WordOfTheDay } from '@/lib/meetings/draft';
import { EMPTY_DRAFT } from '@/lib/meetings/draft';
import type { MeetingSeed } from '@/lib/meetings/from-planner';

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

function findSpeaker(draft: MeetingDraft, speakerId: string): DraftSpeaker | undefined {
  return draft.speakers.find((speaker) => speaker.id === speakerId);
}

interface MeetingScoped {
  meetingId: string;
}

export const meetingDraftSlice = createSlice({
  name: 'meetingDraft',
  initialState,
  reducers: {
    /** Fills a brand-new meeting's draft from the planner row it was created
     * from. An outright replace rather than a merge: the only caller is the
     * create flow, and the meeting cannot have been edited yet. */
    draftSeeded: {
      reducer(state, action: PayloadAction<MeetingScoped & { draft: MeetingDraft }>) {
        state.byMeetingId[action.payload.meetingId] = action.payload.draft;
      },
      /* Speaker ids are minted here so the reducer stays pure and replayable —
       * the same split `speakerAdded` uses. */
      prepare(meetingId: string, seed: MeetingSeed) {
        const draft: MeetingDraft = {
          ...structuredClone(EMPTY_DRAFT),
          roles: { ...seed.roles },
          speakers: seed.speakers.map((speaker) => ({
            id: nanoid(),
            status: 'requested' as const,
            title: '',
            memberId: speaker.memberId,
            evaluatorId: speaker.evaluatorId,
            /* Carried over rather than typed here, so the cards start clean and
             * collapsed — the titles are what still need chasing. */
            dirty: false,
            expanded: false,
          })),
        };
        return { payload: { meetingId, draft } };
      },
    },
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
    roleAssigned(
      state,
      action: PayloadAction<MeetingScoped & { roleKey: string; memberId: string | undefined }>,
    ) {
      const draft = ensureDraft(state, action.payload.meetingId);
      draft.roles[action.payload.roleKey] = action.payload.memberId;
    },
    speakerAdded: {
      reducer(state, action: PayloadAction<MeetingScoped & { id: string }>) {
        ensureDraft(state, action.payload.meetingId).speakers.push({
          id: action.payload.id,
          status: 'requested',
          title: '',
          dirty: true,
          expanded: true,
        });
      },
      /* The id is minted here rather than in the reducer so the reducer stays
       * pure and replayable. */
      prepare(meetingId: string) {
        return { payload: { meetingId, id: nanoid() } };
      },
    },
    speakerChanged(
      state,
      action: PayloadAction<MeetingScoped & { speakerId: string; patch: Partial<DraftSpeaker> }>,
    ) {
      const draft = ensureDraft(state, action.payload.meetingId);
      const speaker = findSpeaker(draft, action.payload.speakerId);
      if (speaker) Object.assign(speaker, action.payload.patch, { dirty: true });
    },
    speakerRemoved(state, action: PayloadAction<MeetingScoped & { speakerId: string }>) {
      const draft = ensureDraft(state, action.payload.meetingId);
      draft.speakers = draft.speakers.filter((speaker) => speaker.id !== action.payload.speakerId);
    },
    speakerSaved(state, action: PayloadAction<MeetingScoped & { speakerId: string }>) {
      const speaker = findSpeaker(
        ensureDraft(state, action.payload.meetingId),
        action.payload.speakerId,
      );
      if (speaker) speaker.dirty = false;
    },
    speakerToggled(state, action: PayloadAction<MeetingScoped & { speakerId: string }>) {
      const speaker = findSpeaker(
        ensureDraft(state, action.payload.meetingId),
        action.payload.speakerId,
      );
      if (speaker) speaker.expanded = !speaker.expanded;
    },
  },
  selectors: {
    /* Falls back to the shared blank draft so consumers never branch on
     * "has this meeting been touched yet". */
    selectMeetingDraft: (state, meetingId: string): MeetingDraft =>
      state.byMeetingId[meetingId] ?? EMPTY_DRAFT,
  },
});

export const {
  draftSeeded,
  draftHydrated,
  themeChanged,
  wordChanged,
  roleAssigned,
  speakerAdded,
  speakerChanged,
  speakerRemoved,
  speakerSaved,
  speakerToggled,
} = meetingDraftSlice.actions;

export const { selectMeetingDraft } = meetingDraftSlice.selectors;
