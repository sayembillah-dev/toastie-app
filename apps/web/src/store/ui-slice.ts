import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

/**
 * Client-only view state — the bits of UI that outlive a single component but
 * are not server data. Deliberately *not* persisted: the store is created fresh
 * on every render pass, so anything read from localStorage at init time would
 * differ between the server and client trees and trip a hydration mismatch.
 */
export interface UiState {
  sidebarCollapsed: boolean;
  /** Filter text for the members directory. Lives here so a future saved-view or
   * command-palette can drive the same grid. */
  memberSearchQuery: string;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  memberSearchQuery: '',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    sidebarCollapsedSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    memberSearchQueryChanged(state, action: PayloadAction<string>) {
      state.memberSearchQuery = action.payload;
    },
  },
  selectors: {
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    selectMemberSearchQuery: (state) => state.memberSearchQuery,
  },
});

export const { sidebarToggled, sidebarCollapsedSet, memberSearchQueryChanged } = uiSlice.actions;
export const { selectSidebarCollapsed, selectMemberSearchQuery } = uiSlice.selectors;
