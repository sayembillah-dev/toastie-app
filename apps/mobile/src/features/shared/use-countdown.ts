import { useEffect, useState } from 'react';

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
};

function diff(target: Date): Countdown {
  const ms = target.getTime() - Date.now();
  const abs = Math.abs(ms);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    isPast: ms < 0,
  };
}

/**
 * A minute-resolution countdown. Ticks once a minute rather than once a second
 * because nothing on the dashboard shows seconds, and a per-second re-render is
 * a battery cost paid for a digit nobody reads.
 */
export function useCountdown(isoDate: string | null | undefined): Countdown | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isoDate) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isoDate]);

  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;

  // `now` is read so the memo-free recompute is tied to the tick.
  void now;
  return diff(target);
}

export function formatCountdown(countdown: Countdown): string {
  const { days, hours, minutes, isPast } = countdown;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  const span = parts.join(' ');
  return isPast ? `${span} ago` : `in ${span}`;
}
