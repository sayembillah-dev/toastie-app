import { CalendarCheck, Sparkle, Users } from '@phosphor-icons/react/dist/ssr';

function StatChip({
  Icon,
  label,
  value,
  tint,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string; weight?: 'regular' | 'bold' }>;
  label: string;
  value: string | number;
  tint: { bg: string; fg: string };
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-fill/60 p-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        <Icon size={15} weight="bold" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-none text-ink">{value}</div>
        <div className="mt-1 text-[11px] text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

interface ClubPulseCardProps {
  activeMembers: number;
  meetingsHeld: number;
  upcomingMeetings: number;
}

/** The club-wide numbers, not the member's own — how big the club is and how
 * many meetings it has actually run. Every member reads the same figures
 * here, unlike the personal cards around it. */
export function ClubPulseCard({
  activeMembers,
  meetingsHeld,
  upcomingMeetings,
}: ClubPulseCardProps) {
  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <h2 className="text-sm font-semibold text-ink">Club pulse</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatChip
          Icon={Users}
          label="Active members"
          value={activeMembers}
          tint={{ bg: '#DBEAFE', fg: '#1E3A8A' }}
        />
        <StatChip
          Icon={CalendarCheck}
          label="Meetings held"
          value={meetingsHeld}
          tint={{ bg: '#D1FAE5', fg: '#065F46' }}
        />
        <StatChip
          Icon={Sparkle}
          label="Upcoming"
          value={upcomingMeetings}
          tint={{ bg: '#FEF3C7', fg: '#78350F' }}
        />
      </div>
    </article>
  );
}
