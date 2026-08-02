import { configureStore } from '@reduxjs/toolkit';

import { toastlyApi } from './api';
import { meetingDraftSlice } from './meeting-draft-slice';
import { uiSlice } from './ui-slice';

/**
 * A factory rather than a module-level singleton: in the App Router a server
 * render must not share a store between requests, and `StoreProvider` needs a
 * fresh instance per client tree.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      [toastlyApi.reducerPath]: toastlyApi.reducer,
      [uiSlice.reducerPath]: uiSlice.reducer,
      [meetingDraftSlice.reducerPath]: meetingDraftSlice.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(toastlyApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
