import {
  CalendarCheck,
  ChartLineUp,
  Microphone,
  MicrophoneStage,
} from '@phosphor-icons/react/dist/ssr';

import type { Engagement } from '@/lib/education/engagement';
import type { MemberStats } from '@/lib/education/history';

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill-strong">
      <div
        className="h-full rounded-full bg-ink transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

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

interface ClubStandingCardProps {
  stats: MemberStats;
  engagement: Engagement;
}

/** "How am I doing at this club" in one glance — the numbers a member would
 * otherwise have to ask the VPE for. Attendance and activity both come from
 * `computeEngagement`, the same roll-up the People > engagement view uses. */
export function ClubStandingCard({ stats, engagement }: ClubStandingCardProps) {
  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <h2 className="text-sm font-semibold text-ink">Club standing</h2>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatChip
          Icon={Microphone}
          label="Speeches given"
          value={stats.speechesGiven}
          tint={{ bg: '#DBEAFE', fg: '#1E3A8A' }}
        />
        <StatChip
          Icon={MicrophoneStage}
          label="Roles taken"
          value={stats.rolesTaken}
          tint={{ bg: '#CFFAFE', fg: '#155E75' }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-ink-soft">
              <CalendarCheck size={13} weight="bold" />
              Attendance
            </span>
            <span className="font-semibold text-ink">{engagement.attendancePercent}%</span>
          </div>
          <div className="mt-1.5">
            <ProgressBar percent={engagement.attendancePercent} />
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            {engagement.meetingsAttended} of {engagement.meetingsHeld} meetings since joining
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-ink-soft">
              <ChartLineUp size={13} weight="bold" />
              Activity
            </span>
            <span className="font-semibold text-ink">{engagement.activityPercent}%</span>
          </div>
          <div className="mt-1.5">
            <ProgressBar percent={engagement.activityPercent} />
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Share of attended meetings you spoke or took a role in
          </p>
        </div>
      </div>
    </article>
  );
}
