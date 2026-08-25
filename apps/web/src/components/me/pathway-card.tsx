import { CalendarBlank, Compass, Flag, Path, PencilSimple } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import { useState } from 'react';

import { StartPathwayModal } from '@/components/education/start-pathway-modal';
import type { HistoryEvent, MemberStats } from '@/lib/education/history';
import type { Level, Member, Pathway } from '@/lib/education/members';
import {
  getLevelRequiredCount,
  getNextProject,
  getProjectDuration,
} from '@/lib/education/pathways';

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Five-segment bar filled to `level`. Mirrors the Education tab's LevelBar —
 * kept local since that one isn't exported, same duplication trade-off the
 * People profile already makes for the avatar palette. */
function LevelBar({ level }: { level: number }) {
  return (
    <div role="img" className="flex gap-1.5" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((segment) => (
        <div
          key={segment}
          className={`h-2 flex-1 rounded-full transition-colors ${
            segment <= level ? 'bg-ink' : 'bg-fill-strong'
          }`}
        />
      ))}
    </div>
  );
}

interface PathwayCardProps {
  member: Member;
  stats: MemberStats;
  history: HistoryEvent[];
}

/** "Where am I in my pathway" — current project, how many speeches stand
 * between here and the next level, and what's up after this one. Everything
 * is read straight off the canonical Pathways catalog rather than guessed, so
 * it stays true when the catalog changes. */
export function PathwayCard({ member, stats, history }: PathwayCardProps) {
  const [pathwayModalOpen, setPathwayModalOpen] = useState(false);

  if (!member.pathway || !member.level) {
    return (
      <article className="rounded-xl border border-dashed border-line-strong bg-canvas px-6 py-10 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <Flag size={20} weight="bold" />
        </span>
        <h2 className="text-sm font-semibold text-ink">No pathway started yet</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-ink-soft">
          Start your pathway to see project progress, levels, and what&apos;s next — right here.
        </p>
        <Button
          type="primary"
          size="middle"
          className="mt-5"
          icon={<Path size={14} weight="bold" />}
          onClick={() => setPathwayModalOpen(true)}
        >
          Start Pathway
        </Button>
        <StartPathwayModal
          open={pathwayModalOpen}
          member={member}
          onClose={() => setPathwayModalOpen(false)}
        />
      </article>
    );
  }

  const pathway: Pathway = member.pathway;
  const level: Level = member.level;
  /* The level actively being worked — the current project's own level once
   * one exists, since a member can start a project ahead of the level badge
   * (which only advances once every requirement clears). Falls back to the
   * badge level between projects. */
  const activeLevel: Level = stats.currentProject?.level ?? level;

  const completedThisLevel = history.filter(
    (event) =>
      event.type === 'project-completed' &&
      event.pathway === pathway &&
      event.level === activeLevel,
  ).length;
  const requiredThisLevel = getLevelRequiredCount(pathway, activeLevel);
  const speechesLeft = Math.max(0, requiredThisLevel - completedThisLevel);

  const completedProjectNames = history
    .filter((event) => event.type === 'project-completed')
    .map((event) => (event.type === 'project-completed' ? event.projectName : ''));

  const nextProject = getNextProject(
    pathway,
    activeLevel,
    completedProjectNames,
    stats.currentProject?.name,
  );

  return (
    <article className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Path size={14} weight="bold" />
            Current pathway
          </div>
          <h2 className="mt-1.5 text-xl font-semibold text-ink">{pathway}</h2>
          <p className="mt-1 text-sm text-ink-soft">Level {level} of 5</p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <button
            type="button"
            onClick={() => setPathwayModalOpen(true)}
            aria-label="Update your pathway"
            title="Update pathway"
            className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-fill hover:text-ink"
          >
            <PencilSimple size={16} weight="bold" />
          </button>
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white"
          >
            <span className="text-sm font-semibold">L{level}</span>
          </span>
        </div>
      </div>

      <div className="mt-4">
        <LevelBar level={level} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-fill/60 p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <Compass size={13} weight="bold" />
            Current project
          </div>
          {stats.currentProject ? (
            <>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">
                {stats.currentProject.name}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Level {stats.currentProject.level} · Started{' '}
                {formatDate(stats.currentProject.startedDate)}
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-ink-muted">Between projects</p>
          )}
          <p className="mt-2 text-xs font-medium text-ink-soft">
            {speechesLeft === 0
              ? `Level ${activeLevel} requirements met`
              : `${speechesLeft} speech${speechesLeft === 1 ? '' : 'es'} left in Level ${activeLevel}`}
          </p>
        </div>

        <div className="rounded-lg bg-fill/60 p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <CalendarBlank size={13} weight="bold" />
            Up next
          </div>
          {nextProject ? (
            <>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">
                {nextProject.name}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                Level {nextProject.level} · {getProjectDuration(nextProject.name, pathway).min}–
                {getProjectDuration(nextProject.name, pathway).max} min
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-ink-muted">Pathway complete — nothing queued yet</p>
          )}
        </div>
      </div>

      <StartPathwayModal
        open={pathwayModalOpen}
        member={member}
        onClose={() => setPathwayModalOpen(false)}
      />
    </article>
  );
}
