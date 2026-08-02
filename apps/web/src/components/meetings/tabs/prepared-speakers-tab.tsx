'use client';

import { CaretDown, Plus, TrashSimple } from '@phosphor-icons/react/dist/ssr';
import { Button, Input, InputNumber, Select } from 'antd';
import { useMemo } from 'react';
import type { Pathway } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import type { ProjectDefinition } from '@/lib/education/pathways';
import { findProject, getProjectDuration, getProjectsForPathway } from '@/lib/education/pathways';
import type { DraftSpeaker, SpeakerStatus } from '@/lib/meetings/draft';
import type { Meeting } from '@/lib/meetings/meetings';
import { useGetMembersQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectMeetingDraft,
  speakerAdded,
  speakerChanged,
  speakerRemoved,
  speakerSaved,
  speakerToggled,
} from '@/store/meeting-draft-slice';

const MAX_SPEAKERS = 3;

/** Official Pathways two-letter abbreviations, used on the Path option so the
 * dropdown reads "Dynamic Leadership (DL)" like the club forms do. */
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

const STATUS_STYLES: Record<SpeakerStatus, { label: string; bg: string; fg: string }> = {
  requested: { label: 'Requested', bg: '#F5F5F5', fg: '#525252' },
  confirmed: { label: 'Confirmed', bg: '#D1FAE5', fg: '#065F46' },
  delivered: { label: 'Delivered', bg: '#DBEAFE', fg: '#1E3A8A' },
};

interface MemberOption {
  value: string;
  label: string;
}

/** Uniform label + control wrapper. `span` maps to a `md:col-span-N` — the
 * grid is 6 wide on desktop and single-column on phones. */
const SPAN_CLASSES: Record<2 | 3 | 4 | 6, string> = {
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  6: 'md:col-span-6',
};

function FieldWrap({
  label,
  span,
  htmlFor,
  children,
}: {
  label: string;
  span: 2 | 3 | 4 | 6;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={SPAN_CLASSES[span]}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

interface SpeakerCardProps {
  index: number;
  speaker: DraftSpeaker;
  memberOptions: MemberOption[];
  membersLoading: boolean;
  onChange: (patch: Partial<DraftSpeaker>) => void;
  onDelete: () => void;
  onSave: () => void;
  onToggle: () => void;
}

function SpeakerCard({
  index,
  speaker,
  memberOptions,
  membersLoading,
  onChange,
  onDelete,
  onSave,
  onToggle,
}: SpeakerCardProps) {
  const idPrefix = `speaker-${speaker.id}`;
  const bodyId = `${idPrefix}-body`;

  const projectOptions = useMemo(() => {
    if (!speaker.pathway) return [];
    return getProjectsForPathway(speaker.pathway).map((project: ProjectDefinition) => ({
      value: project.name,
      label: `L${project.level} · ${project.name}`,
    }));
  }, [speaker.pathway]);

  const selectedProject = speaker.project ? findProject(speaker.project) : undefined;
  const durationBounds = getProjectDuration(selectedProject?.name);
  const status = STATUS_STYLES[speaker.status];

  /* Changing the pathway invalidates any previously selected project — level
   * and duration derive from that project, so keeping the stale value would
   * silently mislead the panel below. */
  function handlePathwayChange(pathway: Pathway | undefined) {
    onChange({ pathway, project: undefined });
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-sidebar">
      {/* The toggle wraps only the chevron + #/title cluster — the status pill
       * and delete button stay outside so they don't fight the accordion for
       * clicks. The whole header row aligns to the same baseline either way. */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={speaker.expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-ink-muted transition-transform ${
              speaker.expanded ? '' : '-rotate-90'
            }`}
          />
          <span className="text-sm font-semibold text-ink-muted">#{index}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
            {speaker.title.trim() || 'Untitled speech'}
          </span>
        </button>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.label}
        </span>
        <Button
          type="text"
          size="small"
          aria-label={`Delete speaker #${index}`}
          icon={<TrashSimple size={16} className="text-ink-muted" />}
          onClick={onDelete}
        />
      </div>

      {/* Body stays mounted-then-hidden so form state doesn't reset on
       * collapse and antd Selects keep their dropdown portal roots. */}
      <div id={bodyId} hidden={!speaker.expanded} className="border-t border-line p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <FieldWrap label="Speaker" span={4} htmlFor={`${idPrefix}-member`}>
            <Select
              id={`${idPrefix}-member`}
              size="large"
              className="w-full"
              placeholder={membersLoading ? 'Loading members…' : 'Select a member'}
              value={speaker.memberId}
              options={memberOptions}
              loading={membersLoading}
              onChange={(value) => onChange({ memberId: value })}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </FieldWrap>

          <FieldWrap label="Duration (min)" span={2} htmlFor={`${idPrefix}-duration`}>
            <InputNumber
              id={`${idPrefix}-duration`}
              size="large"
              className="w-full"
              min={durationBounds.min}
              max={durationBounds.max}
              value={speaker.duration}
              placeholder={`${durationBounds.min}–${durationBounds.max}`}
              onChange={(value) => onChange({ duration: value ?? undefined })}
            />
          </FieldWrap>

          <FieldWrap label="Speech Title" span={6} htmlFor={`${idPrefix}-title`}>
            <Input
              id={`${idPrefix}-title`}
              size="large"
              placeholder="e.g. The fear of becoming yourself"
              value={speaker.title}
              maxLength={120}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </FieldWrap>

          <FieldWrap label="Evaluator" span={2} htmlFor={`${idPrefix}-evaluator`}>
            <Select
              id={`${idPrefix}-evaluator`}
              size="large"
              className="w-full"
              placeholder={membersLoading ? 'Loading…' : 'Select evaluator'}
              value={speaker.evaluatorId}
              options={memberOptions}
              loading={membersLoading}
              onChange={(value) => onChange({ evaluatorId: value })}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </FieldWrap>

          <FieldWrap label="Path" span={2} htmlFor={`${idPrefix}-path`}>
            <Select
              id={`${idPrefix}-path`}
              size="large"
              className="w-full"
              placeholder="Select a pathway"
              value={speaker.pathway}
              options={PATHWAYS.map((pathway) => ({
                value: pathway,
                label: `${pathway} (${PATHWAY_ABBREV[pathway]})`,
              }))}
              onChange={handlePathwayChange}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </FieldWrap>

          <FieldWrap label="Project" span={2} htmlFor={`${idPrefix}-project`}>
            <Select
              id={`${idPrefix}-project`}
              size="large"
              className="w-full"
              placeholder={speaker.pathway ? 'Select project' : 'Pick a path first'}
              value={speaker.project}
              options={projectOptions}
              disabled={!speaker.pathway}
              onChange={(value) => onChange({ project: value })}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </FieldWrap>

          <FieldWrap label="Level" span={2} htmlFor={`${idPrefix}-level`}>
            <Input
              id={`${idPrefix}-level`}
              size="large"
              disabled
              value={selectedProject ? `Level ${selectedProject.level}` : ''}
              placeholder="Set by project"
            />
          </FieldWrap>

          <FieldWrap label="Notes (optional)" span={4} htmlFor={`${idPrefix}-notes`}>
            <Input
              id={`${idPrefix}-notes`}
              size="large"
              placeholder="e.g. Using presentation software"
              value={speaker.notes ?? ''}
              maxLength={160}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          </FieldWrap>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-ink-muted">
            {selectedProject ? (
              <>
                Level and duration bounds ({durationBounds.min}–{durationBounds.max} min) come from
                the Pathways project.
              </>
            ) : (
              <>
                Duration defaults to {durationBounds.min}–{durationBounds.max} min until a project
                is selected.
              </>
            )}
          </p>
          <Button
            type="primary"
            onClick={onSave}
            disabled={!speaker.dirty}
            className="self-end sm:self-auto"
          >
            {speaker.dirty ? 'Save speaker' : 'Saved'}
          </Button>
        </div>
      </div>
    </article>
  );
}

interface PreparedSpeakersTabProps {
  meeting: Meeting;
}

/** Prepared Speakers tab — an inline editor per speaker with a member picker,
 * pathway/project cascade (which drives the level and duration bounds), and a
 * quick-add row at the bottom capped at MAX_SPEAKERS. Speakers live in the
 * meeting draft, which is what the Overview → Agenda sheet prints from. */
export function PreparedSpeakersTab({ meeting }: PreparedSpeakersTabProps) {
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const dispatch = useAppDispatch();
  const speakers = useAppSelector((state) => selectMeetingDraft(state, meeting.id)).speakers;

  const canAdd = speakers.length < MAX_SPEAKERS;

  const memberOptions = useMemo<MemberOption[]>(
    () =>
      (members ?? [])
        .map((member) => ({
          value: member.id,
          label: `${member.firstName} ${member.lastName}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [members],
  );

  function handleAdd() {
    if (!canAdd) return;
    dispatch(speakerAdded(meeting.id));
  }

  function handleChange(speakerId: string, patch: Partial<DraftSpeaker>) {
    dispatch(speakerChanged({ meetingId: meeting.id, speakerId, patch }));
  }

  function handleDelete(speakerId: string) {
    dispatch(speakerRemoved({ meetingId: meeting.id, speakerId }));
  }

  function handleSave(speakerId: string) {
    dispatch(speakerSaved({ meetingId: meeting.id, speakerId }));
  }

  function handleToggle(speakerId: string) {
    dispatch(speakerToggled({ meetingId: meeting.id, speakerId }));
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Prepared Speakers</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Add up to {MAX_SPEAKERS} speakers. Level and duration follow the selected Pathways
              project.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
            {speakers.length}/{MAX_SPEAKERS}
          </span>
        </header>

        {speakers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">No speakers yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Use the button below to add the first prepared speaker.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {speakers.map((speaker, index) => (
              <SpeakerCard
                key={speaker.id}
                index={index + 1}
                speaker={speaker}
                memberOptions={memberOptions}
                membersLoading={membersLoading}
                onChange={(patch) => handleChange(speaker.id, patch)}
                onDelete={() => handleDelete(speaker.id)}
                onSave={() => handleSave(speaker.id)}
                onToggle={() => handleToggle(speaker.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-4">
          <Button
            block
            size="large"
            type="dashed"
            icon={<Plus size={16} weight="bold" />}
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Add speaker ({speakers.length}/{MAX_SPEAKERS})
          </Button>
        </div>
      </div>
    </section>
  );
}
