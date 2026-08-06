import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

/** The scope the user is currently acting inside. `club` is the built-out
 * experience; the higher tiers are placeholders while their surfaces are
 * designed. */
export const UNIT_KEYS = [
  'club',
  'club-admin',
  'area',
  'division',
  'district',
  'super-admin',
] as const;
export type UnitKey = (typeof UNIT_KEYS)[number];

/**
 * Client-only view state — the bits of UI that outlive a single component but
 * are not server data. Deliberately *not* persisted: the store is created fresh
 * on every render pass, so anything read from localStorage at init time would
 * differ between the server and client trees and trip a hydration mismatch.
 */
export interface BreadcrumbCrumb {
  href: string;
  title: string;
}

/** A screen-supplied breadcrumb — either a full `trail` (for routes with more
 * than one dynamic segment) or a `label` overriding the last computed crumb
 * (for routes with a single dynamic id whose human name lives in data).
 * `null` means the shell falls back to computing the trail from the pathname. */
export interface BreadcrumbSlot {
  trail: BreadcrumbCrumb[] | null;
  label: string | null;
}

export interface UiState {
  sidebarCollapsed: boolean;
  /** Whether the mobile nav drawer is open. Separate from `sidebarCollapsed`:
   * below the `md` breakpoint the sider is hidden outright and the same nav is
   * served from a drawer, so the two never describe the same widget. */
  mobileNavOpen: boolean;
  /** Filter text for the members directory. Lives here so a future saved-view or
   * command-palette can drive the same grid. */
  memberSearchQuery: string;
  /** Which organisational tier the shell is scoped to. Drives the sidebar
   * contents and the routed page — anything other than `club` is a stub for
   * now. */
  activeUnit: UnitKey;
  /** Screen-supplied breadcrumb slot. Written by `PageBreadcrumb`, read by
   * `AppShell`. Kept in the store rather than passed as a prop because the
   * shell is now mounted by `app/(app)/layout.tsx` rather than by each page. */
  breadcrumb: BreadcrumbSlot;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
  memberSearchQuery: '',
  activeUnit: 'club',
  breadcrumb: { trail: null, label: null },
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
    activeUnitChanged(state, action: PayloadAction<UnitKey>) {
      state.activeUnit = action.payload;
    },
    breadcrumbSet(state, action: PayloadAction<BreadcrumbSlot>) {
      state.breadcrumb = action.payload;
    },
    breadcrumbCleared(state) {
      state.breadcrumb = { trail: null, label: null };
    },
  },
  selectors: {
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    selectMobileNavOpen: (state) => state.mobileNavOpen,
    selectMemberSearchQuery: (state) => state.memberSearchQuery,
    selectActiveUnit: (state) => state.activeUnit,
    selectBreadcrumb: (state) => state.breadcrumb,
  },
});

export const {
  sidebarToggled,
  sidebarCollapsedSet,
  mobileNavOpened,
  mobileNavClosed,
  memberSearchQueryChanged,
  activeUnitChanged,
  breadcrumbSet,
  breadcrumbCleared,
} = uiSlice.actions;
export const {
  selectSidebarCollapsed,
  selectMobileNavOpen,
  selectMemberSearchQuery,
  selectActiveUnit,
  selectBreadcrumb,
} = uiSlice.selectors;
