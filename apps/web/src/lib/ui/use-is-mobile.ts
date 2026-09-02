'use client';

import { useEffect, useState } from 'react';

/** Matches Tailwind's `md` (768px) — the same pivot the app shell uses to
 * swap the sidebar for a drawer, so every layout decision stays on one grid. */
export const MOBILE_BREAKPOINT = 768;

/** SSR-safe breakpoint read. `matchMedia` only exists on the client, so the
 * hook returns `null` on the server and through the first client frame, then
 * resolves and keeps tracking viewport changes.
 *
 * Consumers rendering two different layouts should treat `null` as "not known
 * yet" and show a placeholder rather than assuming either side — assuming
 * desktop flashes the wrong layout on phones, and vice versa. */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return isMobile;
}
