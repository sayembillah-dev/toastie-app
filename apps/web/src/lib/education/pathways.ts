import type { Level, Pathway } from './members';

export interface ProjectDefinition {
  name: string;
  level: Level;
}

/** Toastmasters Pathways projects. The catalog is deliberately kept shared
 * across all pathways — the electives overlap heavily in real life and the
 * modal never asks the member to distinguish, so a single list is enough for
 * the start-pathway flow. */
export const PATHWAY_PROJECTS: ProjectDefinition[] = [
  { name: 'Ice Breaker', level: 1 },
  { name: 'Evaluation and Feedback', level: 1 },
  { name: 'Researching and Presenting', level: 1 },
  { name: 'Understanding Your Communication Style', level: 2 },
  { name: 'Understanding Your Leadership Style', level: 2 },
  { name: 'Active Listening', level: 2 },
  { name: 'Introduction to Toastmasters Mentoring', level: 2 },
  { name: 'Connect with Storytelling', level: 3 },
  { name: 'Effective Body Language', level: 3 },
  { name: 'Understanding Vocal Variety', level: 3 },
  { name: 'Building a Social Media Presence', level: 3 },
  { name: 'Understanding Emotional Intelligence', level: 3 },
  { name: 'Managing a Difficult Audience', level: 4 },
  { name: 'Preparing to Speak Professionally', level: 4 },
  { name: 'Coaching Others', level: 4 },
  { name: 'Public Relations Strategies', level: 4 },
  { name: 'Reflect on Your Path', level: 5 },
  { name: 'Prepare for Success', level: 5 },
  { name: 'Ethical Leadership', level: 5 },
  { name: 'Lead in Any Situation', level: 5 },
];

export function getProjectsForPathway(_pathway: Pathway): ProjectDefinition[] {
  return PATHWAY_PROJECTS;
}

export function findProject(name: string): ProjectDefinition | undefined {
  return PATHWAY_PROJECTS.find((project) => project.name === name);
}

/** Standard Pathways speech length in minutes. Ice Breaker runs 4–6, every
 * other project runs 5–7 by default — the real range for individual projects
 * varies a touch but this covers the common case. */
export function getProjectDuration(name: string | undefined): { min: number; max: number } {
  if (name === 'Ice Breaker') return { min: 4, max: 6 };
  return { min: 5, max: 7 };
}
