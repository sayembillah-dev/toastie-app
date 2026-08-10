'use client';

import { useCallback, useSyncExternalStore } from 'react';

/* The URL is a store that lives outside React. Every consumer of
 * `usePersistentTab` subscribes here so that `onChange` — which flips
 * the state through `history.replaceState` rather than `setState` — can
 * nudge them to re-read. */
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function notifyAll() {
  for (const listener of listeners) listener();
}

/** Persist an antd `<Tabs>` `activeKey` across refreshes via a URL search
 * parameter. On mount the tab seeds from the URL; every change writes back
 * with `history.replaceState` so the parameter travels with a refresh but
 * does not clutter the back stack.
 *
 * The parameter is dropped when the user is on the default tab, and the
 * whole thing is naturally cleared when the user navigates away — a fresh
 * navigation back to the page arrives without a query string, so the tab
 * reverts to the default. Reading through `useSyncExternalStore` keeps SSR
 * and hydration in agreement (server snapshot is `null`), matching the
 * pattern in `useLightSession`. */
export function usePersistentTab(name: string, defaultKey: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  const activeKey = raw ?? defaultKey;

  const onChange = useCallback(
    (key: string) => {
      const params = new URLSearchParams(window.location.search);
      if (key === defaultKey) params.delete(name);
      else params.set(name, key);
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', url);
      notifyAll();
    },
    [name, defaultKey],
  );

  return { activeKey, onChange };
}
