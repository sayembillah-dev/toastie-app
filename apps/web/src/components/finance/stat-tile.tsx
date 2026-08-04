import type { ReactNode } from 'react';

export type StatTileTone = 'default' | 'positive' | 'negative' | 'warning';

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: StatTileTone;
}

const TONE_CLASSES: Record<StatTileTone, string> = {
  default: 'text-ink',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  warning: 'text-amber-700',
};

/** A single figure-and-label card. Used on Overview for the headline numbers
 * and on the other tabs for their summary rows, so the four tabs read as one
 * consistent surface. */
export function StatTile({ icon, label, value, hint, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-2 text-ink-muted">
        <span aria-hidden>{icon}</span>
        <span className="text-xs font-medium tracking-wide uppercase">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${TONE_CLASSES[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
