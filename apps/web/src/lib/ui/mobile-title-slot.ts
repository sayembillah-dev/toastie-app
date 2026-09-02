'use client';

import { useSyncExternalStore } from 'react';

/** Module-level slot for a page-supplied MOBILE header title. The shell's
 * top-left mobile title is otherwise just the last breadcrumb's plain text,
 * which can't host interactive controls like the meeting detail page's
 * meeting switcher. Kept outside Redux because the payload is a ReactNode
 * (non-serializable — the store runs the default serializableCheck), and
 * driven through useSyncExternalStore so a write re-renders the shell.
 *
 * Written by `PageBreadcrumb` (which owns the breadcrumb slot already) and
 * read by `AppShell`. */

let current: React.ReactNode = null;
const listeners = new Set<() => void>();

export function setMobileTitle(node: React.ReactNode): void {
  current = node;
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The node a page has registered, or null → the shell falls back to the
 * breadcrumb text. The server snapshot is always null so hydration matches
 * the server tree — pages register from an effect, after hydration. */
export function useMobileTitle(): React.ReactNode {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
