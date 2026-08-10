import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { ActiveContextKey } from '@toastly/access';

/** The scope the shell is currently rendering for. Derived from
 * `session.contextKey` via `unitKeyForContext` — no separate state.
 * Prior versions carried an `activeUnit` field on ui-slice that defaulted
 * to `'club'` and was only updated on switcher click, which meant a
 * Super Admin in `global` context saw the club sidebar on first load. */
export type UnitKey = 'club' | 'area' | 'division' | 'district' | 'super-admin';

/** Maps the session's `contextKey` to the shell's nav-shape hint. Returns
 * `null` when the context is missing or unrecognised — callers render an
 * empty rail rather than guessing at a fallback. */
export function unitKeyForContext(
  key: ActiveContextKey | string | null | undefined,
): UnitKey | null {
  if (!key) return null;
  if (key === 'global') return 'super-admin';
  if (key.startsWith('club:')) return 'club';
  if (key.startsWith('area:')) return 'area';
  if (key.startsWith('division:')) return 'division';
  if (key.startsWith('district:')) return 'district';
  return null;
}

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
  /** Screen-supplied breadcrumb slot. Written by `PageBreadcrumb`, read by
   * `AppShell`. Kept in the store rather than passed as a prop because the
   * shell is now mounted by `app/(app)/layout.tsx` rather than by each page. */
  breadcrumb: BreadcrumbSlot;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  mobileNavOpen: false,
  memberSearchQuery: '',
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
    selectBreadcrumb: (state) => state.breadcrumb,
  },
});

export const {
  sidebarToggled,
  sidebarCollapsedSet,
  mobileNavOpened,
  mobileNavClosed,
  memberSearchQueryChanged,
  breadcrumbSet,
  breadcrumbCleared,
} = uiSlice.actions;
export const {
  selectSidebarCollapsed,
  selectMobileNavOpen,
  selectMemberSearchQuery,
  selectBreadcrumb,
} = uiSlice.selectors;
