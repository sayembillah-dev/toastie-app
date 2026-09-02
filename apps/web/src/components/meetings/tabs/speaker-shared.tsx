'use client';

import { ChatCircleDots, Copy, DownloadSimple } from '@phosphor-icons/react/dist/ssr';
import { Button, Drawer, Input, InputNumber, Modal, QRCode, Select, Tooltip } from 'antd';
import { useMemo, useRef } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import type { Member, Pathway } from '@/lib/education/members';
import { PATHWAYS } from '@/lib/education/members';
import type { ProjectDefinition } from '@/lib/education/pathways';
import { findProject, getProjectDuration, getProjectsForPathway } from '@/lib/education/pathways';
import type { PreparedSpeakerWire, SpeakerStatus } from '@/lib/meetings/prepared-speakers';
import {
  evaluatorAssignee,
  SPEAKER_STATUSES,
  speakerAssignee,
} from '@/lib/meetings/prepared-speakers';
import { assigneeToRef } from '@/lib/meetings/role-assignments';
import type { Guest } from '@/lib/people/guests';
import { useBlurCommit } from '@/lib/use-blur-commit';

/** Everything the desktop accordion and the mobile cards + details sheet
 * share, so the two presentations can never drift: the form fields, the
 * status pill, the evaluation QR modal, the feedback badge, and the name /
 * progress / evaluation-link derivations. Presentation stays with the
 * callers; data and business logic live here. */

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

/** Resolves a speaker slot to "First Last" — members need a roster lookup;
 * guests already carry their resolved name on the `Assignee` itself. */
export function speakerDisplayName(
  speaker: PreparedSpeakerWire,
  members: Member[],
  guests: Guest[],
): string | undefined {
  const assignee = speakerAssignee(speaker, guests);
  if (!assignee) return undefined;
  if (assignee.kind === 'member') {
    const member = members.find((m) => m.id === assignee.memberId);
    return member ? `${member.firstName} ${member.lastName}` : undefined;
  }
  return assignee.name;
}

/** Setup progress for the mobile card's completion ring — the six fields a
 * speaker slot needs before meeting day: who's speaking, how long, the
 * speech title, who evaluates, and the Pathways path + project. */
export function speakerSetupRatio(speaker: PreparedSpeakerWire): number {
  const filled = [
    Boolean(speaker.membershipId || speaker.guestId),
    speaker.duration != null,
    speaker.title.trim().length > 0,
    Boolean(speaker.evaluatorMembershipId || speaker.evaluatorGuestId),
    Boolean(speaker.pathway),
    Boolean(speaker.project),
  ].filter(Boolean).length;
  return filled / 6;
}

/** The public evaluation link for one speaker — the QR modal encodes it on
 * desktop, and the mobile card's share button hands it to the native share
 * sheet. Empty string until there's a token and a speaker to point at. */
export function useEvaluationUrl(meetingId: string, shareToken: string, speakerId: string): string {
  return useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    if (!shareToken || !speakerId) return '';
    const token = encodeURIComponent(shareToken);
    return `${origin}/meetings/${meetingId}/evaluate/${speakerId}?t=${token}`;
  }, [meetingId, speakerId, shareToken]);
}

interface StatusPillSelectProps {
  value: SpeakerStatus;
  onChange: (next: SpeakerStatus) => void;
  ariaLabel: string;
  /** Width/behaviour override — the desktop accordion header keeps the
   * default `w-25`; the mobile details sheet passes a wider class so the
   * label never truncates. */
  className?: string;
}

/** The status pill IS the picker — the borderless select is styled as the
 * coloured chip itself (semantic slots: root = pill body, content = label
 * text, suffix = chevron), so a header carries one compact control instead
 * of a select plus a duplicate badge. */
export function StatusPillSelect({ value, onChange, ariaLabel, className }: StatusPillSelectProps) {
  const status = STATUS_STYLES[value];
  return (
    <Select
      size="small"
      variant="borderless"
      className={className ?? 'w-25 shrink-0'}
      value={value}
      options={SPEAKER_STATUSES.map((s) => ({ value: s, label: STATUS_STYLES[s].label }))}
      onChange={(next) => onChange(next)}
      aria-label={ariaLabel}
      popupMatchSelectWidth={false}
      styles={{
        root: {
          backgroundColor: status.bg,
          borderRadius: 9999,
          paddingInline: 8,
          transition: 'background-color 150ms ease',
        },
        content: {
          color: status.fg,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        },
        suffix: { color: status.fg },
      }}
    />
  );
}

/** Small pill shown next to the status/QR cluster once at least one public
 * evaluation has landed for a speaker. `count` comes straight off the
 * `getPreparedSpeakers` list response — refetches on its own schedule like
 * the rest of the tab, no separate subscription needed. */
export function FeedbackBadge({ count }: { count: number }) {
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

interface EvaluationQrProps {
  url: string;
  speakerName: string | undefined;
  speechTitle: string;
  onCopy: () => void;
}

interface EvaluationQrModalProps extends EvaluationQrProps {
  open: boolean;
  onClose: () => void;
}

/** The QR + copyable-link content, chrome-free — the desktop wraps it in a
 * centred Modal, phones in a bottom sheet (`EvaluationQrSheet`). Rendering
 * the QR with `type="canvas"` (the antd default) means we can grab the
 * canvas at download time and encode it directly, without a second render
 * pass. */
export function EvaluationQrBody({ url, speakerName, speechTitle, onCopy }: EvaluationQrProps) {
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
  );
}

/** Evaluation QR modal — the desktop chrome around `EvaluationQrBody`. */
export function EvaluationQrModal({
  open,
  onClose,
  url,
  speakerName,
  speechTitle,
  onCopy,
}: EvaluationQrModalProps) {
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
      <EvaluationQrBody
        url={url}
        speakerName={speakerName}
        speechTitle={speechTitle}
        onCopy={onCopy}
      />
    </Modal>
  );
}

/** The mobile chrome around `EvaluationQrBody` — a bottom sheet, matching
 * the details sheet it usually sits on top of. `push={false}` so any sheet
 * nested inside this one can't shove it sideways; stopping THIS sheet from
 * pushing its parents is the parents' own `push={false}` (rc-drawer reads
 * the push config from the drawer being pushed, not the one opening). */
export function EvaluationQrSheet({
  open,
  onClose,
  url,
  speakerName,
  speechTitle,
  onCopy,
}: EvaluationQrModalProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      size="auto"
      push={false}
      closable={false}
      destroyOnHidden
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        /* Headerless sheet, so the body is the whole scroll region — cap it
         * directly or very small phones can't reach the download button. */
        body: {
          padding: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
          overflowY: 'auto',
          maxHeight: '85dvh',
        },
      }}
    >
      <EvaluationQrBody
        url={url}
        speakerName={speakerName}
        speechTitle={speechTitle}
        onCopy={onCopy}
      />
    </Drawer>
  );
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

interface SpeakerFormFieldsProps {
  idPrefix: string;
  speaker: PreparedSpeakerWire;
  members: Member[];
  guests: Guest[];
  onPatch: (patch: Partial<PreparedSpeakerWire>) => void;
  /** The desktop card owns the title field's blur-commit so its collapsed
   * header echoes keystrokes live; the mobile sheet lets the form keep its
   * own internal one. */
  titleField?: ReturnType<typeof useBlurCommit<string>>;
}

/** The speaker editor form — the desktop accordion body and the mobile
 * details sheet render this exact same grid, so a field added once appears
 * in both. Already single-column below `md`; spans only apply on desktop. */
export function SpeakerFormFields({
  idPrefix,
  speaker,
  members,
  guests,
  onPatch,
  titleField,
}: SpeakerFormFieldsProps) {
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

  const speakerAssigneeValue = speakerAssignee(speaker, guests);
  const evaluatorAssigneeValue = evaluatorAssignee(speaker, guests);

  const ownTitleField = useBlurCommit(speaker.title, (next) => onPatch({ title: next }));
  const title = titleField ?? ownTitleField;
  const notesField = useBlurCommit(speaker.notes ?? '', (next) => onPatch({ notes: next || null }));
  const durationField = useBlurCommit(speaker.duration ?? undefined, (next) =>
    onPatch({ duration: next ?? null }),
  );

  /* Changing the pathway invalidates any previously selected project — level
   * and duration derive from that project, so keeping the stale value would
   * silently mislead the panel below. */
  function handlePathwayChange(pathway: Pathway | undefined) {
    onPatch({ pathway: pathway ?? null, project: null });
  }

  return (
    <>
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
            variant="outlined"
            size="large"
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
            value={title.value}
            maxLength={120}
            onChange={(event) => title.onChange(event.target.value)}
            onFocus={title.onFocus}
            onBlur={title.onBlur}
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
            variant="outlined"
            size="large"
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
            Level and duration bounds ({durationBounds.min}–{durationBounds.max} min) come from the
            Pathways project.
          </>
        ) : (
          <>
            Duration defaults to {durationBounds.min}–{durationBounds.max} min until a project is
            selected.
          </>
        )}
      </p>
    </>
  );
}
