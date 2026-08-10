'use client';

import { WifiSlash } from '@phosphor-icons/react/dist/ssr';
import { useOffline } from 'next/offline';

/**
 * Full-viewport takeover while the connection is down — not just a banner.
 * The app underneath stays mounted (so Redux state, form drafts, etc. are
 * untouched) and this simply covers it; `useOffline` flips back to `false`
 * the moment a background connectivity check succeeds (see
 * `experimental.useOffline` in next.config.ts), which unmounts this and
 * reveals the app exactly where the user left it.
 */
export function OfflineScreen() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-sidebar px-6 text-center"
    >
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-fill text-ink-soft"
      >
        <WifiSlash size={26} weight="bold" />
      </span>
      <div>
        <p className="text-base font-semibold text-ink">You&rsquo;re offline</p>
        <p className="mt-1 max-w-xs text-sm text-ink-soft">
          Check your connection. This page will pick up right where you left off once you&rsquo;re
          back online.
        </p>
      </div>
    </div>
  );
}
