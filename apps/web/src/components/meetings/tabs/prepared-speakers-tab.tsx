'use client';

import {
  CaretDown,
  ChatCircleDots,
  Copy,
  DownloadSimple,
  Plus,
  QrCode,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, InputNumber, Modal, QRCode, Select, Tooltip } from 'antd';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Pathway } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import type { ProjectDefinition } from '@/lib/education/pathways';
import { findProject, getProjectDuration, getProjectsForPathway } from '@/lib/education/pathways';
import { readSubmissions, subscribeToSubmissions } from '@/lib/evaluation/storage';
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

interface EvaluationQrModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  speakerName: string | undefined;
  speechTitle: string;
  onCopy: () => void;
}

/** Evaluation QR modal — shows a scannable QR for the speaker's evaluation
 * link, along with a copyable URL row and a PNG download. Rendering the QR
 * with `type="canvas"` (the antd default) means we can grab the canvas at
 * download time and encode it directly, without a second render pass. */
function EvaluationQrModal({
  open,
  onClose,
  url,
  speakerName,
  speechTitle,
  onCopy,
}: EvaluationQrModalProps) {
  const qrWrapRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const filename =
      (speakerName ? speakerName.replace(/\s+/g, '-').toLowerCase() : 'speaker') +
      '-evaluation-qr.png';
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  const heading = speakerName || 'Speaker evaluation';
  const subheading = speakerName
    ? speechTitle
      ? `Evaluation for “${speechTitle}”`
      : 'Scan or share the evaluation link'
    : 'Scan or share the evaluation link';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={440}
      destroyOnHidden
      title={null}
      styles={{ body: { padding: 0 } }}
      classNames={{ body: 'overflow-hidden rounded-b-2xl' }}
    >
      <div className="flex flex-col">
        <div className="border-b border-line px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Evaluation link
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold text-ink">{heading}</h3>
          <p className="mt-0.5 truncate text-xs text-ink-soft">{subheading}</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-6 pt-6">
          <div
            ref={qrWrapRef}
            className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <QRCode
              value={url || ' '}
              size={224}
              bordered={false}
              errorLevel="M"
              color="#1c1c1c"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-center text-[11px] text-ink-muted">
            Scan with a phone camera to open the evaluation form.
          </p>
        </div>

        <div className="flex flex-col gap-3 px-6 pb-6 pt-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Or share the link
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={url} size="large" className="!bg-fill !text-ink" />
            <Button
              size="large"
              icon={<Copy size={16} />}
              onClick={onCopy}
              aria-label="Copy evaluation link"
            >
              Copy
            </Button>
          </div>
          <Button
            block
            type="primary"
            size="large"
            icon={<DownloadSimple size={16} weight="bold" />}
            onClick={handleDownload}
          >
            Download QR as image
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Small pill shown next to the status/QR cluster once at least one public
 * evaluation has landed for a speaker. Reads localStorage via
 * `useSyncExternalStore` so a submission from the shared link — or from a
 * phone using the same-origin browser — updates the count without a reload. */
function FeedbackBadge({ meetingId, speakerId }: { meetingId: string; speakerId: string }) {
  const subscribe = useCallback(
    (notify: () => void) => subscribeToSubmissions(meetingId, speakerId, notify),
    [meetingId, speakerId],
  );
  const submissions = useSyncExternalStore(
    subscribe,
    () => readSubmissions(meetingId, speakerId),
    () => [],
  );
  const count = submissions.length;
  if (count === 0) return null;
  return (
    <Tooltip title={`${count} evaluation${count === 1 ? '' : 's'} received — see the Me page`}>
      <span
        role="img"
        aria-label={`${count} evaluation${count === 1 ? '' : 's'} received`}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
      >
        <ChatCircleDots size={11} weight="fill" />
        {count}
      </span>
    </Tooltip>
  );
}

interface SpeakerCardProps {
  index: number;
  meetingId: string;
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
  meetingId,
  speaker,
  memberOptions,
  membersLoading,
  onChange,
  onDelete,
  onSave,
  onToggle,
}: SpeakerCardProps) {
  const { message } = App.useApp();
  const idPrefix = `speaker-${speaker.id}`;
  const bodyId = `${idPrefix}-body`;

  const projectOptions = useMemo(() => {
    if (!speaker.pathway) return [];
    return getProjectsForPathway(speaker.pathway).map((project: ProjectDefinition) => ({
      value: project.name,
      label: `L${project.level} · ${project.name}`,
    }));
  }, [speaker.pathway]);

  const selectedProject = speaker.project
    ? findProject(speaker.project, speaker.pathway)
    : undefined;
  const durationBounds = getProjectDuration(selectedProject?.name, speaker.pathway);
  const status = STATUS_STYLES[speaker.status];

  const speakerName = speaker.memberId
    ? memberOptions.find((option) => option.value === speaker.memberId)?.label
    : undefined;
  const trimmedTitle = speaker.title.trim();

  /* Changing the pathway invalidates any previously selected project — level
   * and duration derive from that project, so keeping the stale value would
   * silently mislead the panel below. */
  function handlePathwayChange(pathway: Pathway | undefined) {
    onChange({ pathway, project: undefined });
  }

  const [qrOpen, setQrOpen] = useState(false);
  const evaluationUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${origin}/meetings/${meetingId}/evaluate/${speaker.id}`;
  }, [meetingId, speaker.id]);

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
          <span className="min-w-0 flex-1 truncate text-sm">
            {speakerName ? (
              <>
                <span className="font-semibold text-ink">{speakerName}</span>
                {trimmedTitle && (
                  <>
                    <span className="mx-1.5 text-ink-muted">·</span>
                    <span className="text-ink-muted">{trimmedTitle}</span>
                  </>
                )}
              </>
            ) : (
              <span className="font-semibold text-ink">{trimmedTitle || 'Untitled speech'}</span>
            )}
          </span>
        </button>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.label}
        </span>
        <FeedbackBadge meetingId={meetingId} speakerId={speaker.id} />
        <Tooltip title="Show evaluation QR">
          <Button
            type="text"
            size="small"
            aria-label={`Show evaluation QR for speaker #${index}`}
            icon={<QrCode size={16} className="text-ink-muted" />}
            onClick={() => setQrOpen(true)}
          />
        </Tooltip>
      </div>

      <EvaluationQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={evaluationUrl}
        speakerName={speakerName}
        speechTitle={trimmedTitle}
        onCopy={async () => {
          try {
            await navigator.clipboard.writeText(evaluationUrl);
            message.success('Evaluation link copied');
          } catch {
            message.error('Could not copy link');
          }
        }}
      />

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
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              danger
              icon={<TrashSimple size={16} />}
              onClick={onDelete}
              aria-label={`Delete speaker #${index}`}
            >
              Delete
            </Button>
            <Button type="primary" onClick={onSave} disabled={!speaker.dirty}>
              {speaker.dirty ? 'Save speaker' : 'Saved'}
            </Button>
          </div>
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
                meetingId={meeting.id}
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
