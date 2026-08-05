import rawCatalog from './data/pathway-catalog.json';
import type { Level, Pathway } from './members';

/**
 * Canonical Toastmasters Pathways catalog. This is the source of truth for
 * every pathway/level/project/speech-time shown anywhere in the app — the
 * Education > Pathways tab renders it directly, and the start-pathway modal,
 * prepared-speakers project picker, and the local API's validation all read
 * through the helpers below rather than keeping their own copies.
 */

export interface CatalogProject {
  name: string;
  speechTime: string;
  kind: 'required' | 'elective';
}

export interface CatalogLevel {
  level: Level;
  title: string;
  requiredProjects: CatalogProject[];
  electivesRequiredCount: number;
  electives: CatalogProject[];
}

export interface PathwayCatalogEntry {
  id: string;
  name: Pathway;
  description: string;
  levels: CatalogLevel[];
}

export interface LevelStructureEntry {
  level: Level;
  title: string;
}

interface RawProject {
  name: string;
  speech_time: string;
}

interface RawLevel {
  level: number;
  title: string;
  required_projects: RawProject[];
  electives_required_count: number;
  electives: RawProject[];
}

interface RawPathway {
  id: string;
  name: string;
  description: string;
  levels: RawLevel[];
}

interface RawCatalog {
  program: string;
  total_paths: number;
  levels_structure: { level: number; title: string }[];
  pathways: RawPathway[];
}

const raw = rawCatalog as RawCatalog;

export const LEVEL_STRUCTURE: LevelStructureEntry[] = raw.levels_structure.map((entry) => ({
  level: entry.level as Level,
  title: entry.title,
}));

export const PATHWAY_CATALOG: PathwayCatalogEntry[] = raw.pathways.map((pathway) => ({
  id: pathway.id,
  name: pathway.name as Pathway,
  description: pathway.description,
  levels: pathway.levels.map((level) => ({
    level: level.level as Level,
    title: level.title,
    requiredProjects: level.required_projects.map((project) => ({
      name: project.name,
      speechTime: project.speech_time,
      kind: 'required' as const,
    })),
    electivesRequiredCount: level.electives_required_count,
    electives: level.electives.map((project) => ({
      name: project.name,
      speechTime: project.speech_time,
      kind: 'elective' as const,
    })),
  })),
}));

export function getPathwayCatalog(pathway: Pathway): PathwayCatalogEntry | undefined {
  return PATHWAY_CATALOG.find((entry) => entry.name === pathway);
}

/** Flat, de-duplicated per-pathway project list — kept for callers that only
 * need "what can this member work on" rather than the full level breakdown. */
export interface ProjectDefinition {
  name: string;
  level: Level;
  speechTime: string;
  kind: 'required' | 'elective';
}

export function getProjectsForPathway(pathway: Pathway): ProjectDefinition[] {
  const entry = getPathwayCatalog(pathway);
  if (!entry) return [];

  const seen = new Set<string>();
  const projects: ProjectDefinition[] = [];
  for (const level of entry.levels) {
    for (const project of [...level.requiredProjects, ...level.electives]) {
      if (seen.has(project.name)) continue;
      seen.add(project.name);
      projects.push({ ...project, level: level.level });
    }
  }
  return projects;
}

/** Looks up a project by name. Pass `pathway` when it's known — the same
 * project can sit at a different level on different pathways — otherwise
 * every pathway is searched and the first match wins. */
export function findProject(name: string, pathway?: Pathway): ProjectDefinition | undefined {
  if (pathway) {
    const match = getProjectsForPathway(pathway).find((project) => project.name === name);
    if (match) return match;
  }
  for (const entry of PATHWAY_CATALOG) {
    const match = getProjectsForPathway(entry.name).find((project) => project.name === name);
    if (match) return match;
  }
  return undefined;
}

/** How many projects (required + the electives the level asks for) it takes
 * to clear a level — the denominator for a "speeches left" countdown. */
export function getLevelRequiredCount(pathway: Pathway, level: Level): number {
  const levelEntry = getPathwayCatalog(pathway)?.levels.find((entry) => entry.level === level);
  if (!levelEntry) return 0;
  return levelEntry.requiredProjects.length + levelEntry.electivesRequiredCount;
}

/** The project a member should tackle after `currentProjectName` — the next
 * uncompleted project at the same level (required projects before
 * electives), or the first required project of the next level once the
 * current one is exhausted. Used for the Me page's "up next" card. */
export function getNextProject(
  pathway: Pathway,
  level: Level,
  completedProjectNames: readonly string[],
  currentProjectName?: string,
): ProjectDefinition | undefined {
  const completed = new Set(completedProjectNames);
  const remaining = getProjectsForPathway(pathway).filter(
    (project) =>
      project.level === level &&
      project.name !== currentProjectName &&
      !completed.has(project.name),
  );
  if (remaining.length > 0) {
    return remaining.find((project) => project.kind === 'required') ?? remaining[0];
  }

  if (level >= 5) return undefined;
  const nextLevel = (level + 1) as Level;
  return getProjectsForPathway(pathway).find(
    (project) => project.level === nextLevel && project.kind === 'required',
  );
}

/** Parses the catalog's free-text `speechTime` (e.g. "5–7 minutes") into
 * numeric minute bounds for the duration input. Entries that describe a role
 * or format rather than a timed speech (e.g. "Serve as Topicsmaster during a
 * meeting") fall back to the Pathways-standard 5–7 minutes. */
export function getProjectDuration(
  name: string | undefined,
  pathway?: Pathway,
): { min: number; max: number } {
  const project = name ? findProject(name, pathway) : undefined;
  if (!project) return { min: 5, max: 7 };

  const range = project.speechTime.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };

  const single = project.speechTime.match(/(\d+)\s*minute/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };

  return { min: 5, max: 7 };
}
