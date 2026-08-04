'use client';

import {
  BookOpen,
  Calendar,
  CheckCircle,
  Compass,
  Flag,
  Microphone,
  MicrophoneStage,
  Path,
  Trophy,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { Button } from 'antd';

import type { Member } from '@/lib/education/members';
import { useGetMemberStatsQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface ProgressTabProps {
  member: Member;
  onStartPathway: () => void;
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
          <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</div>
          <div className="mt-0.5 text-lg font-semibold leading-none text-ink">{value}</div>
          {sublabel ? (
            <div className="mt-1 truncate text-[11px] text-ink-muted">{sublabel}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Five-segment bar that fills up to `level`. Segments earned before the
 * member joined this platform (below `startingLevel`) are rendered in a lighter
 * ink so the platform journey stays visually distinct from prior progress. */
function LevelBar({ level, startingLevel = 1 }: { level: number; startingLevel?: number }) {
  return (
    <div
      role="img"
      className="flex gap-1.5"
      aria-label={`Level ${level} of 5${
        startingLevel > 1 ? `, started from level ${startingLevel}` : ''
      }`}
    >
      {[1, 2, 3, 4, 5].map((segment) => {
        const isBeforePlatform = segment < startingLevel;
        const isFilled = segment <= level && !isBeforePlatform;
        return (
          <div
            key={segment}
            className={`h-2 flex-1 rounded-full transition-colors ${
              isBeforePlatform ? 'bg-ink/20' : isFilled ? 'bg-ink' : 'bg-fill-strong'
            }`}
          />
        );
      })}
    </div>
  );
}

function EmptyPathway({ onStartPathway }: { onStartPathway: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-canvas px-6 py-12 text-center">
      <span
        aria-hidden
        className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-fill text-ink-soft"
      >
        <Flag size={22} weight="bold" />
      </span>
      <h2 className="text-base font-semibold text-ink">No pathway yet</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">
        Start a pathway to unlock progress tracking. Speeches, projects, and level milestones will
        show up here as soon as the journey begins.
      </p>
      <Button
        type="primary"
        size="middle"
        className="mt-5"
        icon={<Path size={14} weight="bold" />}
        onClick={onStartPathway}
      >
        Start Pathway
      </Button>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-hidden>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="h-40 animate-pulse rounded-xl border border-line bg-fill" />
        <div className="h-32 animate-pulse rounded-xl border border-line bg-fill" />
        <div className="h-28 animate-pulse rounded-xl border border-line bg-fill" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
            key={index}
            className="h-18.5 animate-pulse rounded-xl border border-line bg-fill"
          />
        ))}
      </div>
    </div>
  );
}

export function ProgressTab({ member, onStartPathway }: ProgressTabProps) {
  /* The roll-up is computed by the API layer, not during render — the same call
   * shape a `GET /members/:id/stats` endpoint will answer. Members without a
   * pathway have nothing to roll up, so the request is skipped entirely. */
  const {
    data: stats,
    isError,
    error,
  } = useGetMemberStatsQuery(member.pathway && member.level ? member.id : skipToken);

  if (!member.pathway || !member.level) {
    return <EmptyPathway onStartPathway={onStartPathway} />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load progress</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!stats) return <ProgressSkeleton />;

  const currentLevel = member.level;
  const startingLevel = member.startingLevel ?? 1;
  const levelsRemaining = 5 - currentLevel;

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
                Level {currentLevel} of 5 —{' '}
                {levelsRemaining > 0
                  ? `${levelsRemaining} level${levelsRemaining === 1 ? '' : 's'} to go`
                  : 'complete'}
              </p>
              {startingLevel > 1 ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                  <Flag size={11} weight="bold" />
                  Journey on Toastie started at Level {startingLevel}
                </div>
              ) : null}
            </div>
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"
            >
              <span className="text-sm font-semibold">L{currentLevel}</span>
            </span>
          </div>
          <div className="mt-4">
            <LevelBar level={currentLevel} startingLevel={startingLevel} />
          </div>
        </article>

        <article className="rounded-xl border border-line bg-canvas p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Compass size={14} weight="bold" />
            Current project
          </div>
          {stats.currentProject ? (
            <>
              <h3 className="mt-1.5 text-lg font-semibold text-ink">{stats.currentProject.name}</h3>
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
          sublabel={stats.favouriteRole ? `Most often: ${stats.favouriteRole.role}` : undefined}
          Icon={MicrophoneStage}
          tint={{ bg: '#CFFAFE', fg: '#155E75' }}
        />
        <StatTile
          label="Current level"
          value={`Level ${currentLevel}`}
          Icon={Trophy}
          tint={{ bg: '#FFE4E6', fg: '#9F1239' }}
        />
        <div className="mt-1 rounded-xl border border-dashed border-line-strong bg-canvas p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <BookOpen size={14} weight="bold" />
            Member since
          </div>
          <div className="mt-1 text-sm font-semibold text-ink">{formatDate(stats.joinedAt)}</div>
        </div>
      </aside>
    </div>
  );
}
