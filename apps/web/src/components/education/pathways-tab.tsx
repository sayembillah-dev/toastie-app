'use client';

import {
  CaretRight,
  GraduationCap,
  Info,
  MagnifyingGlass,
  Path,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { Drawer, Input } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import type { CatalogLevel, CatalogProject, PathwayCatalogEntry } from '@/lib/education/pathways';
import { PATHWAY_CATALOG } from '@/lib/education/pathways';

const GRID_CLASSES = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';

/** Same pastel pairing used on the member directory cards, so a pathway and a
 * member badge read as the same visual language. Each entry stays
 * contrast-safe on its own so the icon reads cleanly on any swatch. */
const ACCENT_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

/** djb2-ish string hash — stable across server and client renders so the same
 * pathway always lands on the same swatch. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Builds the "tell me about this project" Google search a member can hand
 * straight to an AI overview or the first result. */
function projectSearchUrl({
  level,
  levelTitle,
  pathwayName,
  projectName,
}: {
  level: number;
  levelTitle: string;
  pathwayName: string;
  projectName: string;
}): string {
  const query = `I am currently Level ${level}: ${levelTitle} of ${pathwayName} and ${projectName} project in toastmaster. Tell me all about the project please.`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

interface PathwayMatch {
  pathway: PathwayCatalogEntry;
  matchedProjects: string[];
}

/** Matches a pathway by name/description OR by any project or elective inside
 * it — search is the whole point of the catalog, so a member who only
 * remembers "Ice Breaker" should still land on every pathway that has it. */
function matchPathway(pathway: PathwayCatalogEntry, needle: string): PathwayMatch | null {
  const nameHit =
    pathway.name.toLowerCase().includes(needle) ||
    pathway.description.toLowerCase().includes(needle);

  const matchedProjects = new Set<string>();
  for (const level of pathway.levels) {
    for (const project of [...level.requiredProjects, ...level.electives]) {
      if (project.name.toLowerCase().includes(needle)) matchedProjects.add(project.name);
    }
  }

  if (!nameHit && matchedProjects.size === 0) return null;
  return { pathway, matchedProjects: Array.from(matchedProjects) };
}

function ProjectRow({
  project,
  highlighted,
  level,
  levelTitle,
  pathwayName,
}: {
  project: CatalogProject;
  highlighted: boolean;
  level: number;
  levelTitle: string;
  pathwayName: string;
}) {
  return (
    <div
      id={`project-${slugify(project.name)}`}
      className={`relative rounded-lg border px-3 py-2 pr-8 text-xs transition-colors sm:text-sm ${
        highlighted ? 'border-ink bg-fill' : 'border-line bg-canvas'
      }`}
    >
      <a
        href={projectSearchUrl({ level, levelTitle, pathwayName, projectName: project.name })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Search for more about ${project.name}`}
        title="Look this project up"
        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-fill-strong hover:text-ink"
      >
        <Info size={14} weight="bold" />
      </a>
      <div className="pr-1 font-medium text-ink">{project.name}</div>
      <div className="mt-1 inline-block rounded-full bg-fill-strong px-2 py-0.5 text-[10px] font-medium text-ink-soft sm:text-[11px]">
        {project.speechTime}
      </div>
    </div>
  );
}

function LevelSection({
  level,
  highlightSet,
  pathwayName,
}: {
  level: CatalogLevel;
  highlightSet: Set<string>;
  pathwayName: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-sidebar p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
          {level.level}
        </span>
        <h4 className="text-sm font-semibold text-ink">{level.title}</h4>
        <span className="ml-auto text-[11px] text-ink-muted">
          {level.requiredProjects.length} required
          {level.electivesRequiredCount > 0
            ? ` · pick ${level.electivesRequiredCount} elective${level.electivesRequiredCount === 1 ? '' : 's'}`
            : ''}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {level.requiredProjects.map((project) => (
          <ProjectRow
            key={project.name}
            project={project}
            highlighted={highlightSet.has(project.name)}
            level={level.level}
            levelTitle={level.title}
            pathwayName={pathwayName}
          />
        ))}
      </div>

      {level.electives.length > 0 ? (
        <div className="mt-3 border-t border-dashed border-line-strong pt-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Electives — choose {level.electivesRequiredCount} of {level.electives.length}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {level.electives.map((project) => (
              <ProjectRow
                key={project.name}
                project={project}
                highlighted={highlightSet.has(project.name)}
                level={level.level}
                levelTitle={level.title}
                pathwayName={pathwayName}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface PathwayCardProps {
  pathway: PathwayCatalogEntry;
  matchedProjects: string[];
  onOpen: () => void;
}

function PathwayCard({ pathway, matchedProjects, onOpen }: PathwayCardProps) {
  const swatch = ACCENT_PALETTE[hashString(pathway.id) % ACCENT_PALETTE.length];
  const requiredCount = pathway.levels.reduce(
    (sum, level) => sum + level.requiredProjects.length,
    0,
  );
  const electiveCount = pathway.levels.reduce((sum, level) => sum + level.electives.length, 0);
  const visibleMatches = matchedProjects.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-xl border border-line bg-canvas p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: swatch.bg, color: swatch.fg }}
        >
          <Path size={16} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">{pathway.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{pathway.description}</p>
        </div>
        <CaretRight
          size={14}
          weight="bold"
          className="mt-1 shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </div>

      {visibleMatches.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleMatches.map((name) => (
            <span
              key={name}
              className="rounded-full bg-fill px-2 py-0.5 text-[11px] font-medium text-ink-soft"
            >
              {name}
            </span>
          ))}
          {matchedProjects.length > visibleMatches.length ? (
            <span className="px-1 py-0.5 text-[11px] text-ink-muted">
              +{matchedProjects.length - visibleMatches.length} more
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <GraduationCap size={12} weight="bold" />5 levels
        </span>
        <span>{requiredCount} required projects</span>
        <span>{electiveCount} electives</span>
      </div>
    </button>
  );
}

function PathwayDetailDrawer({
  pathway,
  highlightProjects,
  onClose,
}: {
  pathway: PathwayCatalogEntry | null;
  highlightProjects: string[];
  onClose: () => void;
}) {
  const highlightSet = useMemo(() => new Set(highlightProjects), [highlightProjects]);

  /* Waits out the drawer's slide-in transition before scrolling, otherwise
   * `scrollIntoView` measures the pre-animation layout and lands short. */
  useEffect(() => {
    if (!pathway || highlightProjects.length === 0) return;
    const targetId = `project-${slugify(highlightProjects[0])}`;
    const timeout = setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 260);
    return () => clearTimeout(timeout);
  }, [pathway, highlightProjects]);

  return (
    <Drawer
      open={pathway !== null}
      onClose={onClose}
      placement="right"
      size="min(720px, 100vw)"
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      {pathway ? (
        <div className="flex h-full flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6 sm:py-5">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"
            >
              <Path size={18} weight="bold" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink">{pathway.name}</h2>
              <p className="mt-1 text-xs text-ink-soft">{pathway.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close pathway details"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-fill hover:text-ink"
            >
              <X size={16} weight="bold" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4">
              {pathway.levels.map((level) => (
                <LevelSection
                  key={level.level}
                  level={level}
                  highlightSet={highlightSet}
                  pathwayName={pathway.name}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

/** Education > Pathways: the full Toastmasters Pathways catalog, searchable
 * by pathway, project, or elective. This is the source of truth other
 * surfaces (start-pathway modal, prepared-speakers project picker) read
 * through — nothing here is duplicated data, it's `PATHWAY_CATALOG` rendered
 * directly. */
export function PathwaysTab() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trimmed = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!trimmed) {
      return PATHWAY_CATALOG.map((pathway) => ({ pathway, matchedProjects: [] as string[] }));
    }
    return PATHWAY_CATALOG.map((pathway) => matchPathway(pathway, trimmed)).filter(
      (match): match is PathwayMatch => match !== null,
    );
  }, [trimmed]);

  const selectedMatch = results.find((result) => result.pathway.id === selectedId) ?? null;
  const selectedPathway =
    selectedMatch?.pathway ??
    (selectedId ? (PATHWAY_CATALOG.find((p) => p.id === selectedId) ?? null) : null);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          The Toastmasters Pathways catalog — every level, project, and speech time in one place.
        </p>
        <div className="w-full sm:w-80">
          <Input
            allowClear
            size="middle"
            placeholder="Search pathways or projects"
            aria-label="Search pathways or projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
          />
        </div>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="text-sm text-ink-soft">
            No pathways or projects match{' '}
            <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>.
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Try a different pathway, project, or elective name.
          </p>
        </div>
      ) : (
        <div className={GRID_CLASSES}>
          {results.map(({ pathway, matchedProjects }) => (
            <PathwayCard
              key={pathway.id}
              pathway={pathway}
              matchedProjects={matchedProjects}
              onOpen={() => setSelectedId(pathway.id)}
            />
          ))}
        </div>
      )}

      <PathwayDetailDrawer
        pathway={selectedPathway}
        highlightProjects={selectedMatch?.matchedProjects ?? []}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
