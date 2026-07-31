import {
  BookOpen,
  Calendar,
  CheckCircle,
  Compass,
  Microphone,
  MicrophoneStage,
  Path,
  Trophy,
} from '@phosphor-icons/react/dist/ssr';

import type { Member } from '@/lib/education/members';
import { getMemberStats } from '@/lib/education/history';

interface ProgressTabProps {
  member: Member;
}

/** Consistently render an ISO date the way the whole timeline expects it —
 * "3 Jun 2025" instead of the browser's default locale variance. */
function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface StatTileProps {
  label: string;
  value: string | number;
  sublabel?: string;
  Icon: React.ComponentType<{ size?: number; className?: string; weight?: 'regular' | 'bold' }>;
  tint: { fg: string; bg: string };
}

function StatTile({ label, value, sublabel, Icon, tint }: StatTileProps) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: tint.bg, color: tint.fg }}
        >
          <Icon size={18} weight="bold" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {label}
          </div>
          <div className="mt-0.5 text-lg font-semibold leading-none text-ink">{value}</div>
          {sublabel ? (
            <div className="mt-1 truncate text-[11px] text-ink-muted">{sublabel}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Five-segment bar that fills up to `level`. Rounded end-caps keep it looking
 * like one bar rather than a strip of pills. */
function LevelBar({ level }: { level: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((segment) => {
        const filled = segment <= level;
        return (
          <div
            key={segment}
            className={`h-2 flex-1 rounded-full transition-colors ${
              filled ? 'bg-ink' : 'bg-fill-strong'
            }`}
          />
        );
      })}
    </div>
  );
}

export function ProgressTab({ member }: ProgressTabProps) {
  const stats = getMemberStats(member);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="lg:col-span-2 flex flex-col gap-4">
        <article className="relative overflow-hidden rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                <Path size={14} weight="bold" />
                Current pathway
              </div>
              <h2 className="mt-1.5 text-xl font-semibold text-ink">{member.pathway}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Level {member.level} of 5 — {5 - member.level > 0
                  ? `${5 - member.level} level${5 - member.level === 1 ? '' : 's'} to go`
                  : 'complete'}
              </p>
            </div>
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"
            >
              <span className="text-sm font-semibold">L{member.level}</span>
            </span>
          </div>
          <div className="mt-4">
            <LevelBar level={member.level} />
          </div>
        </article>

        <article className="rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Compass size={14} weight="bold" />
            Current project
          </div>
          {stats.currentProject ? (
            <>
              <h3 className="mt-1.5 text-lg font-semibold text-ink">
                {stats.currentProject.name}
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                {stats.currentProject.pathway} · Level {stats.currentProject.level}
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-xs text-ink-soft">
                <Calendar size={12} weight="bold" />
                Started {formatDate(stats.currentProject.startedDate)}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              No active project — pick the next one from the Pathways library.
            </p>
          )}
        </article>

        <article className="rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Microphone size={14} weight="bold" />
            Latest speech
          </div>
          {stats.latestSpeech ? (
            <>
              <h3 className="mt-1.5 text-lg font-semibold text-ink">
                &ldquo;{stats.latestSpeech.title}&rdquo;
              </h3>
              <p className="mt-1 text-sm text-ink-soft">
                Meeting #{stats.latestSpeech.meetingNumber} · {formatDate(stats.latestSpeech.date)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              No speeches recorded yet — this member is still preparing their Ice Breaker.
            </p>
          )}
        </article>
      </section>

      <aside className="flex flex-col gap-3">
        <StatTile
          label="Speeches given"
          value={stats.speechesGiven}
          Icon={Microphone}
          tint={{ bg: '#EFF6FF', fg: '#1E3A8A' }}
        />
        <StatTile
          label="Meetings attended"
          value={stats.meetingsAttended}
          Icon={Calendar}
          tint={{ bg: '#F0FDF4', fg: '#166534' }}
        />
        <StatTile
          label="Projects completed"
          value={stats.projectsCompleted}
          Icon={CheckCircle}
          tint={{ bg: '#FEF3C7', fg: '#854D0E' }}
        />
        <StatTile
          label="Meeting roles"
          value={stats.rolesTaken}
          sublabel={
            stats.favouriteRole
              ? `Most often: ${stats.favouriteRole.role}`
              : undefined
          }
          Icon={MicrophoneStage}
          tint={{ bg: '#CFFAFE', fg: '#155E75' }}
        />
        <StatTile
          label="Current level"
          value={`Level ${member.level}`}
          Icon={Trophy}
          tint={{ bg: '#FFE4E6', fg: '#9F1239' }}
        />
        <div className="mt-1 rounded-xl border border-dashed border-line-strong bg-canvas p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <BookOpen size={14} weight="bold" />
            Member since
          </div>
          <div className="mt-1 text-sm font-semibold text-ink">
            {formatDate(stats.joinedAt)}
          </div>
        </div>
      </aside>
    </div>
  );
}
