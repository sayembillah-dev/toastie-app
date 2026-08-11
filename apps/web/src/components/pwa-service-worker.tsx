'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/push/push-notifications';

/**
 * Registers `sw.js` on every page load, independent of push notification
 * opt-in. Android/Chrome's install criteria (unlike iOS Safari's "Add to
 * Home Screen", which has no service-worker requirement) expect a
 * registered service worker before offering "Install app" — without this,
 * that registration only happened once a user opted into push notifications
 * on the profile page, which almost no one had, so the install prompt never
 * showed up on Android.
 */
export function PwaServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    registerServiceWorker().catch(() => {
      // Best-effort — a failed registration just means no install prompt /
      // no push, not a broken app.
    });
  }, []);

  return null;
}
