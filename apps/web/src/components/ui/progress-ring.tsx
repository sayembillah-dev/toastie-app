/* Ring geometry: 44px viewBox, 3px arc, gap-free circle. The svg scales with
 * whatever size utility the caller puts on the wrapper. */
const RING_R = 19;
const RING_C = 2 * Math.PI * RING_R;

interface ProgressRingProps {
  /** 0–1 fills the arc; `null` renders the bare track — used by the live
   * tools (Ah Counter, Timer, Grammarian) where "done" only exists while the
   * meeting is running, not as setup state. Turns emerald at 1. */
  ratio: number | null;
  /** Tailwind size utility on the wrapper — `size-11` on the feature grid,
   * `size-10` on the mobile speaker cards. */
  sizeClass?: string;
  /** Centred content — the section icon on the grid, a check on a finished
   * speaker card, or nothing. */
  children?: React.ReactNode;
  className?: string;
}

/** A completion ring — the arc grows clockwise from twelve o'clock and turns
 * emerald when done. Extracted from the meeting feature grid so the mobile
 * speaker cards share the exact same visual language. */
export function ProgressRing({
  ratio,
  sizeClass = 'size-11',
  children,
  className,
}: ProgressRingProps) {
  const complete = ratio !== null && ratio >= 1;
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center text-ink-soft ${sizeClass} ${className ?? ''}`}
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          strokeWidth={3}
          className={ratio === null ? 'stroke-fill' : 'stroke-fill-strong'}
        />
        {ratio !== null && ratio > 0 ? (
          <circle
            cx="22"
            cy="22"
            r={RING_R}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - Math.min(ratio, 1))}
            className={complete ? 'stroke-emerald-600' : 'stroke-ink'}
          />
        ) : null}
      </svg>
      {children}
    </span>
  );
}
