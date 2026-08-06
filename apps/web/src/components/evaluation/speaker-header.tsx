'use client';

import type { Pathway } from '@/lib/education/members';
import type { ProjectDefinition } from '@/lib/education/pathways';

const PATHWAY_ABBREV: Record<Pathway, string> = {
  'Dynamic Leadership': 'DL',
  'Effective Coaching': 'EC',
  'Engaging Humor': 'EH',
  'Innovative Planning': 'IP',
  'Leadership Development': 'LD',
  'Motivational Strategies': 'MS',
  'Persuasive Influence': 'PI',
  'Presentation Mastery': 'PM',
  'Strategic Relationships': 'SR',
  'Team Collaboration': 'TC',
  'Visionary Communication': 'VC',
};

interface SpeakerHeaderProps {
  clubName: string;
  meetingLabel: string;
  speakerName: string;
  speechTitle: string;
  pathway?: Pathway;
  project?: ProjectDefinition;
  duration?: { min: number; max: number };
}

/** Compact info block that opens the evaluation page — every field mirrors
 * what the Prepared Speakers tab collects, so a scanner sees the same shape
 * of context that appears on the printed agenda. */
export function SpeakerHeader({
  clubName,
  meetingLabel,
  speakerName,
  speechTitle,
  pathway,
  project,
  duration,
}: SpeakerHeaderProps) {
  const chips: string[] = [];
  if (pathway) chips.push(`${pathway} (${PATHWAY_ABBREV[pathway]})`);
  if (project) chips.push(project.name);
  if (project) chips.push(`Level ${project.level}`);
  if (duration) chips.push(`${duration.min}–${duration.max} min`);

  return (
    <header className="border-b border-line bg-sidebar">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {clubName}
          {meetingLabel ? <span className="mx-1.5 text-ink-muted">·</span> : null}
          {meetingLabel ? <span className="text-ink-muted">{meetingLabel}</span> : null}
        </p>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-tight text-ink sm:text-2xl">
            {speakerName || 'Prepared speaker'}
          </h1>
          {speechTitle ? (
            <p className="text-sm text-ink-soft sm:text-base">
              <span className="italic">“{speechTitle}”</span>
            </p>
          ) : (
            <p className="text-sm text-ink-muted sm:text-base">Untitled speech</p>
          )}
        </div>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-medium text-ink-soft"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </header>
  );
}
