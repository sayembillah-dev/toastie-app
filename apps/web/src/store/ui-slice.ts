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
  /** Whether the mobile nav drawer is open. Separate from `sidebarCollapsed`:
   * below the `md` breakpoint the sider is hidden outright and the same nav is
   * served from a drawer, so the two never describe the same widget. */
  mobileNavOpen: boolean;
  /** Filter text for the members directory. Lives here so a future saved-view or
   * command-palette can drive the same grid. */
  memberSearchQuery: string;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
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
    mobileNavOpened(state) {
      state.mobileNavOpen = true;
    },
    mobileNavClosed(state) {
      state.mobileNavOpen = false;
    },
    memberSearchQueryChanged(state, action: PayloadAction<string>) {
      state.memberSearchQuery = action.payload;
    },
  },
  selectors: {
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    selectMobileNavOpen: (state) => state.mobileNavOpen,
    selectMemberSearchQuery: (state) => state.memberSearchQuery,
  },
});

export const {
  sidebarToggled,
  sidebarCollapsedSet,
  mobileNavOpened,
  mobileNavClosed,
  memberSearchQueryChanged,
} = uiSlice.actions;
export const { selectSidebarCollapsed, selectMobileNavOpen, selectMemberSearchQuery } =
  uiSlice.selectors;
