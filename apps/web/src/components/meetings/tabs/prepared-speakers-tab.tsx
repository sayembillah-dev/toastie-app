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
import { App, Button, Input, InputNumber, Modal, Popconfirm, QRCode, Select, Tooltip } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { AssigneeSelect } from '@/components/education/assignee-select';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Member, Pathway } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import type { ProjectDefinition } from '@/lib/education/pathways';
import { findProject, getProjectDuration, getProjectsForPathway } from '@/lib/education/pathways';
import type { Meeting } from '@/lib/meetings/meetings';
import {
  evaluatorAssignee,
  type PreparedSpeakerWire,
  SPEAKER_STATUSES,
  type SpeakerStatus,
  speakerAssignee,
} from '@/lib/meetings/prepared-speakers';
import { assigneeToRef } from '@/lib/meetings/role-assignments';
import type { Guest } from '@/lib/people/guests';
import { useBlurCommit } from '@/lib/use-blur-commit';
import {
  useCreatePreparedSpeakerMutation,
  useDeletePreparedSpeakerMutation,
  useGetGuestsQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useUpdatePreparedSpeakerMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

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
 * evaluation has landed for a speaker. `count` comes straight off the
 * `getPreparedSpeakers` list response — refetches on its own schedule like
 * the rest of the tab, no separate subscription needed. */
function FeedbackBadge({ count }: { count: number }) {
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

/** Resolves a member id to "First Last" — guests already carry their name on
 * the `Assignee` itself, so only the member branch needs a roster lookup. */
function personName(memberId: string | undefined, members: Member[]): string | undefined {
  if (!memberId) return undefined;
  const member = members.find((m) => m.id === memberId);
  return member ? `${member.firstName} ${member.lastName}` : undefined;
}

interface SpeakerCardProps {
  index: number;
  meetingId: string;
  shareToken: string;
  speaker: PreparedSpeakerWire;
  members: Member[];
  guests: Guest[];
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<PreparedSpeakerWire>) => void;
  onDelete: () => void;
}

function SpeakerCard({
  index,
  meetingId,
  shareToken,
  speaker,
  members,
  guests,
  expanded,
  onToggle,
  onPatch,
  onDelete,
}: SpeakerCardProps) {
  const { message } = App.useApp();
  const idPrefix = `speaker-${speaker.id}`;
  const bodyId = `${idPrefix}-body`;

  const projectOptions = useMemo(() => {
    if (!speaker.pathway) return [];
    return getProjectsForPathway(speaker.pathway as Pathway).map((project: ProjectDefinition) => ({
      value: project.name,
      label: `L${project.level} · ${project.name}`,
    }));
  }, [speaker.pathway]);

  const selectedProject = speaker.project
    ? findProject(speaker.project, speaker.pathway as Pathway | undefined)
    : undefined;
  const durationBounds = getProjectDuration(
    selectedProject?.name,
    speaker.pathway as Pathway | undefined,
  );
  const status = STATUS_STYLES[speaker.status];

  const speakerAssigneeValue = speakerAssignee(speaker, guests);
  const evaluatorAssigneeValue = evaluatorAssignee(speaker, guests);
  const speakerName =
    speakerAssigneeValue?.kind === 'member'
      ? personName(speakerAssigneeValue.memberId, members)
      : speakerAssigneeValue?.name;

  const titleField = useBlurCommit(speaker.title, (next) => onPatch({ title: next }));
  const notesField = useBlurCommit(speaker.notes ?? '', (next) => onPatch({ notes: next || null }));
  const durationField = useBlurCommit(speaker.duration ?? undefined, (next) =>
    onPatch({ duration: next ?? null }),
  );
  const trimmedTitle = titleField.value.trim();

  /* Changing the pathway invalidates any previously selected project — level
   * and duration derive from that project, so keeping the stale value would
   * silently mislead the panel below. */
  function handlePathwayChange(pathway: Pathway | undefined) {
    onPatch({ pathway: pathway ?? null, project: null });
  }

  const [qrOpen, setQrOpen] = useState(false);
  const evaluationUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    if (!shareToken) return '';
    const token = encodeURIComponent(shareToken);
    return `${origin}/meetings/${meetingId}/evaluate/${speaker.id}?t=${token}`;
  }, [meetingId, speaker.id, shareToken]);

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-sidebar">
      {/* The toggle wraps only the chevron + #/title cluster — the status pill
       * and delete button stay outside so they don't fight the accordion for
       * clicks. The whole header row aligns to the same baseline either way. */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <CaretDown
            size={14}
            weight="bold"
            aria-hidden
            className={`shrink-0 text-ink-muted transition-transform ${
              expanded ? '' : '-rotate-90'
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
        <Select
          size="small"
          variant="borderless"
          className="w-27.5 shrink-0"
          value={speaker.status}
          options={SPEAKER_STATUSES.map((s) => ({ value: s, label: STATUS_STYLES[s].label }))}
          onChange={(next) => onPatch({ status: next })}
          aria-label={`Status for speaker #${index}`}
          popupMatchSelectWidth={false}
        />
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.label}
        </span>
        <FeedbackBadge count={speaker.evaluationCount} />
        <Tooltip title="Show evaluation QR">
          <Button
            type="text"
            size="small"
            aria-label={`Show evaluation QR for speaker #${index}`}
            icon={<QrCode size={16} className="text-ink-muted" />}
            onClick={() => setQrOpen(true)}
          />
        </Tooltip>
        <Popconfirm
          title="Delete this speaker?"
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button
            danger
            type="text"
            size="small"
            aria-label={`Delete speaker #${index}`}
            icon={<TrashSimple size={16} />}
          />
        </Popconfirm>
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
      <div id={bodyId} hidden={!expanded} className="border-t border-line p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <FieldWrap label="Speaker" span={4} htmlFor={`${idPrefix}-member`}>
            <AssigneeSelect
              value={speakerAssigneeValue}
              onChange={(next) => onPatch(assigneeToRef(next))}
              members={members}
              guests={guests}
              placeholder="Select a speaker"
              ariaLabel="Speaker"
              allowFreeformGuest={false}
            />
          </FieldWrap>

          <FieldWrap label="Duration (min)" span={2} htmlFor={`${idPrefix}-duration`}>
            <InputNumber
              id={`${idPrefix}-duration`}
              size="large"
              className="w-full"
              min={durationBounds.min}
              max={durationBounds.max}
              value={durationField.value}
              placeholder={`${durationBounds.min}–${durationBounds.max}`}
              onChange={(value) => durationField.onChange(value ?? undefined)}
              onFocus={durationField.onFocus}
              onBlur={durationField.onBlur}
            />
          </FieldWrap>

          <FieldWrap label="Speech Title" span={6} htmlFor={`${idPrefix}-title`}>
            <Input
              id={`${idPrefix}-title`}
              size="large"
              placeholder="e.g. The fear of becoming yourself"
              value={titleField.value}
              maxLength={120}
              onChange={(event) => titleField.onChange(event.target.value)}
              onFocus={titleField.onFocus}
              onBlur={titleField.onBlur}
            />
          </FieldWrap>

          <FieldWrap label="Evaluator" span={2} htmlFor={`${idPrefix}-evaluator`}>
            <AssigneeSelect
              value={evaluatorAssigneeValue}
              onChange={(next) => {
                const ref = assigneeToRef(next);
                onPatch({ evaluatorMembershipId: ref.membershipId, evaluatorGuestId: ref.guestId });
              }}
              members={members}
              guests={guests}
              placeholder="Select evaluator"
              ariaLabel="Evaluator"
              allowFreeformGuest={false}
            />
          </FieldWrap>

          <FieldWrap label="Path" span={2} htmlFor={`${idPrefix}-path`}>
            <Select
              id={`${idPrefix}-path`}
              size="large"
              className="w-full"
              placeholder="Select a pathway"
              value={(speaker.pathway ?? undefined) as Pathway | undefined}
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
              value={speaker.project ?? undefined}
              options={projectOptions}
              disabled={!speaker.pathway}
              onChange={(value) => onPatch({ project: value ?? null })}
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
              value={notesField.value}
              maxLength={160}
              onChange={(event) => notesField.onChange(event.target.value)}
              onFocus={notesField.onFocus}
              onBlur={notesField.onBlur}
            />
          </FieldWrap>
        </div>

        <p className="mt-4 text-[11px] text-ink-muted">
          {selectedProject ? (
            <>
              Level and duration bounds ({durationBounds.min}–{durationBounds.max} min) come from
              the Pathways project.
            </>
          ) : (
            <>
              Duration defaults to {durationBounds.min}–{durationBounds.max} min until a project is
              selected.
            </>
          )}
        </p>
      </div>
    </article>
  );
}

interface PreparedSpeakersTabProps {
  meeting: Meeting;
}

/** Prepared Speakers tab — an inline editor per speaker with a member/guest
 * picker, pathway/project cascade (which drives the level and duration
 * bounds), and a quick-add row at the bottom with no cap on how many slots a
 * meeting can hold. Every field saves straight through the API as it's
 * changed — text fields on blur, pickers immediately — matching the Roles
 * tab's no-Save-button pattern. Speakers persist server-side
 * (`MeetingSpeaker`) and mirror with the planner row this meeting was
 * created from. */
export function PreparedSpeakersTab({ meeting }: PreparedSpeakersTabProps) {
  const { message } = App.useApp();
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const { data: guests } = useGetGuestsQuery();
  const { data: speakers, isLoading: speakersLoading } = useGetPreparedSpeakersQuery(meeting.id);
  const [createSpeaker, { isLoading: isCreating }] = useCreatePreparedSpeakerMutation();
  const [updateSpeaker] = useUpdatePreparedSpeakerMutation();
  const [deleteSpeaker] = useDeletePreparedSpeakerMutation();

  /* New cards open expanded so the form is ready to fill; existing ones
   * default collapsed (absent from the set) since a term's worth of
   * speakers reads better as a scannable list. Purely local — nothing here
   * is persisted. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const isLoading = membersLoading || speakersLoading;
  const list = speakers ?? [];

  async function handleAdd() {
    try {
      const created = await createSpeaker({ meetingId: meeting.id }).unwrap();
      setExpandedIds((prev) => new Set(prev).add(created.id));
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add the speaker'));
    }
  }

  function handlePatch(speakerId: string, patch: Partial<PreparedSpeakerWire>) {
    updateSpeaker({ meetingId: meeting.id, speakerId, ...patch })
      .unwrap()
      .catch((err) => message.error(getApiErrorMessage(err, 'Could not save the change')));
  }

  async function handleDelete(speakerId: string) {
    try {
      await deleteSpeaker({ meetingId: meeting.id, speakerId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the speaker'));
    }
  }

  function toggle(speakerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(speakerId)) next.delete(speakerId);
      else next.add(speakerId);
      return next;
    });
  }

  return (
    <section className="mx-auto max-w-4xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Prepared Speakers</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Add as many speakers as the meeting needs. Level and duration follow the selected
              Pathways project.
            </p>
          </div>
          {list.length > 0 ? (
            <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
              {list.length}
            </span>
          ) : null}
        </header>

        <ReadOnly resource="meeting" display="block">
          {isLoading && list.length === 0 ? null : list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
              <p className="text-sm font-medium text-ink">No speakers yet</p>
              <p className="mt-1 text-xs text-ink-muted">
                Use the button below to add the first prepared speaker.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {list.map((speaker, index) => (
                <SpeakerCard
                  key={speaker.id}
                  index={index + 1}
                  meetingId={meeting.id}
                  shareToken={meeting.shareToken}
                  speaker={speaker}
                  members={members ?? []}
                  guests={guests ?? []}
                  expanded={expandedIds.has(speaker.id)}
                  onToggle={() => toggle(speaker.id)}
                  onPatch={(patch) => handlePatch(speaker.id, patch)}
                  onDelete={() => handleDelete(speaker.id)}
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
              loading={isCreating}
              onClick={handleAdd}
            >
              Add speaker
            </Button>
          </div>
        </ReadOnly>
      </div>
    </section>
  );
}
