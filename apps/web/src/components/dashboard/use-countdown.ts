'use client';

import { useSyncExternalStore } from 'react';

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target has passed — the meeting card swaps its copy to
   * "Happening now" instead of ticking into negative numbers. */
  isPast: boolean;
}

function diffToCountdown(targetMs: number, nowMs: number): Countdown {
  const remaining = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isPast: targetMs <= nowMs,
  };
}

function subscribe(onTick: () => void): () => void {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}

function getSnapshot(): number {
  return Date.now();
}

/** Server and the pre-hydration client have no clock worth ticking — `null`
 * lets the caller render a stable placeholder until the real subscription
 * takes over post-hydration. */
function getServerSnapshot(): number | null {
  return null;
}

/** Ticks once a second toward `targetIso`, via a subscription to the
 * system clock rather than a `setState` call inside an effect — the pattern
 * `useSyncExternalStore` exists for, and the only way to update from an
 * external ticker without an extra render on mount. */
export function useCountdown(targetIso: string): Countdown | null {
  const nowMs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (nowMs === null) return null;
  return diffToCountdown(new Date(targetIso).getTime(), nowMs);
}
