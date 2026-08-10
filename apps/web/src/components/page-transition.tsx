'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

/** Enter-only fade + rise on route change, keyed on `pathname`.
 *
 * Enter-only is deliberate. An exit animation needs the outgoing tree to stay
 * mounted after the router has already moved on, so every hook inside it
 * re-runs against the new route (new `useParams`, new `usePathname`, refetched
 * queries) while it fades — the page visibly renders twice per navigation. It
 * also serialises the two halves, so nothing new paints for the length of the
 * exit. Dropping the exit means the new page paints on the first frame after
 * the router commits, which is both faster and stable.
 *
 * The animation itself is CSS (`.page-enter` in `globals.css`) rather than a
 * JS animation loop: opacity + transform only, so it composites off the main
 * thread and costs nothing during the navigation itself. Reduced-motion is
 * handled there too.
 *
 * The `key` is what replays it — a new pathname mounts a fresh node, so the
 * keyframes restart. Search params are excluded on purpose: tab state lives in
 * the query string, and switching tabs should not re-run a page transition. */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  /* Skip the very first paint — on a hard load the content is already there
   * and fading it in only delays it. Latched, so coming back to the entry
   * route later still animates. This is React's documented "adjust state
   * during render" pattern: the set runs before the commit, so the first
   * animated node is mounted with the class already on it — no extra frame,
   * no re-triggered animation. */
  const [entryPathname] = useState(pathname);
  const [hasNavigated, setHasNavigated] = useState(false);
  if (!hasNavigated && pathname !== entryPathname) {
    setHasNavigated(true);
  }

  return (
    <div key={pathname} className={hasNavigated ? 'page-enter' : undefined}>
      {children}
    </div>
  );
}
