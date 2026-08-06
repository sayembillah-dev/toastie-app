'use client';

import { setupListeners } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/lib/auth/token-storage';
import { makeStore } from '@/store';
import { toastlyApi } from '@/store/api';
import { sessionUnauthenticated } from '@/store/session-slice';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  /* Lazy state initialiser rather than a module singleton: the store must be
   * built exactly once per client tree, and a server render must never share
   * one between requests. */
  const [store] = useState(makeStore);

  useEffect(() => {
    const teardownListeners = setupListeners(store.dispatch);

    /* Cross-tab sign-out: another tab clearing the access token is a
     * global sign-out. Drop the RTKQ cache (which is tenant-scoped and
     * would otherwise be readable to the next signed-in user in this
     * tab) and mark the session unauthenticated. `event.key === null`
     * means the other tab called `localStorage.clear()`. */
    const handleStorage = (event: StorageEvent) => {
      const key = event.key;
      const clearedEverything = key === null;
      const clearedAuth =
        (key === ACCESS_TOKEN_KEY || key === REFRESH_TOKEN_KEY) && event.newValue === null;
      if (!clearedEverything && !clearedAuth) return;
      store.dispatch(toastlyApi.util.resetApiState());
      store.dispatch(sessionUnauthenticated());
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      teardownListeners();
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
