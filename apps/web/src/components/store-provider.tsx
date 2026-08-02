'use client';

import { setupListeners } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';
import { Provider } from 'react-redux';

import { DB_KEY_LIST } from '@/lib/local-db/db';
import { makeStore } from '@/store';
import { toastlyApi } from '@/store/api';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  /* Lazy state initialiser rather than a module singleton: the store must be
   * built exactly once per client tree, and a server render must never share
   * one between requests. */
  const [store] = useState(makeStore);

  useEffect(() => {
    const teardownListeners = setupListeners(store.dispatch);

    /* Another tab writing to our tables is the local-storage equivalent of a
     * server-side change: drop the cache and let the active queries refetch.
     * `event.key` is null when a tab calls `localStorage.clear()`. */
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && !DB_KEY_LIST.includes(event.key)) return;
      store.dispatch(toastlyApi.util.invalidateTags(['Member', 'History', 'Meeting']));
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      teardownListeners();
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
