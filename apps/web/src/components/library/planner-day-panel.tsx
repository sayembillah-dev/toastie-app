'use client';

import { Paperclip, Plus, Trash } from '@phosphor-icons/react/dist/ssr';
import type { UploadFile } from 'antd';
import { Button, Input, Select, Skeleton, Typography, Upload } from 'antd';
import { useState } from 'react';

import type { CreatePlannerIdeaInput, IdeaStatus, PlannerIdea } from '@/lib/library/planner';
import {
  IDEA_STATUS_ORDER,
  PLANNER_IDEA_ATTACHMENTS_MAX,
  PLANNER_IDEA_BODY_MAX,
  PLANNER_IDEA_TITLE_MAX,
} from '@/lib/library/planner';

const { TextArea } = Input;
const { Paragraph } = Typography;

/** Rows shown before the body clamps and offers a "See more" toggle. Three
 * lines feels roughly like a card preview without dominating the list. */
const BODY_CLAMP_ROWS = 3;

/** Dot tones are Tailwind defaults so the palette isn't dependent on a status
 * token that doesn't yet exist in the theme. */
const STATUS_META: Record<IdeaStatus, { label: string; dot: string }> = {
  created: { label: 'Created', dot: 'bg-slate-400' },
  drafted: { label: 'Drafted', dot: 'bg-amber-500' },
  published: { label: 'Published', dot: 'bg-emerald-500' },
};

function StatusOptionLabel({ status }: { status: IdeaStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

const STATUS_OPTIONS = IDEA_STATUS_ORDER.map((status) => ({
  value: status,
  label: <StatusOptionLabel status={status} />,
}));

interface PlannerDayPanelProps {
  ideas: PlannerIdea[];
  /** True while the month's ideas are still in flight — the list shows a
   * skeleton rather than the "No ideas yet" empty state, which would
   * otherwise flash on every drawer open. */
  loading?: boolean;
  /** False for viewers with read-only `library` access: the Add button and
   * every per-card control disappear rather than failing with a 403. */
  canMutate?: boolean;
  /* The form supplies the mutable fields; the parent stamps the day and
   * persists, so the panel stays agnostic of the endpoint. Resolves `true`
   * when the write landed — the form only collapses on success, so a failed
   * save doesn't discard what the user typed. */
  onAdd: (idea: Omit<CreatePlannerIdeaInput, 'day'>) => Promise<boolean>;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: IdeaStatus) => void;
}

/** Right-drawer body for a selected day. Two modes: a list of ideas with an
 * Add button, and an inline form that collapses back to the list on save or
 * cancel. */
export function PlannerDayPanel({
  ideas,
  loading = false,
  canMutate = true,
  onAdd,
  onRemove,
  onStatusChange,
}: PlannerDayPanelProps) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {canMutate &&
        (adding ? (
          <IdeaForm
            onSave={async (idea) => {
              const saved = await onAdd(idea);
              if (saved) setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button block icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            Add idea
          </Button>
        ))}

      <IdeasList
        ideas={ideas}
        loading={loading}
        canMutate={canMutate}
        onRemove={onRemove}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

interface IdeaFormProps {
  onSave: (idea: Omit<CreatePlannerIdeaInput, 'day'>) => Promise<void>;
  onCancel: () => void;
}

/** Inline card form. Attachments are captured locally — `beforeUpload`
 * returns `false` so antd never posts them anywhere; only the file names are
 * persisted with the idea. */
function IdeaForm({ onSave, onCancel }: IdeaFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [saving, setSaving] = useState(false);

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        title: trimmedTitle,
        body: body.trim(),
        attachments: fileList.map((file) => ({ uid: file.uid, name: file.name })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-fill/40 p-3">
      <Input
        placeholder="Idea title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={PLANNER_IDEA_TITLE_MAX}
        disabled={saving}
        autoFocus
      />
      <TextArea
        placeholder="Notes"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={PLANNER_IDEA_BODY_MAX}
        rows={3}
        autoSize={{ minRows: 3, maxRows: 8 }}
        disabled={saving}
      />
      <Upload
        multiple
        beforeUpload={() => false}
        fileList={fileList}
        /* Trim to the server's cap here rather than letting the POST come
         * back a 400 — the extra files were never uploaded anyway. */
        onChange={(info) => setFileList(info.fileList.slice(0, PLANNER_IDEA_ATTACHMENTS_MAX))}
        disabled={saving}
      >
        <Button size="small" icon={<Paperclip size={14} />} disabled={saving}>
          Attach files
        </Button>
      </Upload>
      <div className="mt-1 flex justify-end gap-2">
        <Button size="small" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="small"
          type="primary"
          disabled={!canSave}
          loading={saving}
          onClick={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

interface IdeasListProps {
  ideas: PlannerIdea[];
  loading: boolean;
  canMutate: boolean;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: IdeaStatus) => void;
}

function IdeasList({ ideas, loading, canMutate, onRemove, onStatusChange }: IdeasListProps) {
  if (loading && ideas.length === 0) {
    return (
      <div className="rounded-lg border border-line p-3">
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      </div>
    );
  }
  if (ideas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-muted">
        No ideas yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {ideas.map((idea) => (
        <li key={idea.id} className="rounded-lg border border-line p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium text-ink">{idea.title}</h3>
            {canMutate ? (
              <Button
                type="text"
                size="small"
                aria-label={`Delete idea ${idea.title}`}
                icon={<Trash size={14} className="text-ink-muted" />}
                onClick={() => onRemove(idea.id)}
              />
            ) : null}
          </div>
          {idea.body ? (
            /* `!mb-0` cancels antd Typography's default paragraph margin so the
             * body sits flush against the footer row that follows. */
            <Paragraph
              className="!mb-0 mt-1 whitespace-pre-wrap text-sm text-ink-soft"
              ellipsis={{
                rows: BODY_CLAMP_ROWS,
                expandable: 'collapsible',
                symbol: (expanded) => (expanded ? 'See less' : 'See more'),
              }}
            >
              {idea.body}
            </Paragraph>
          ) : null}
          {/* Footer: attachments on the left, status pill pinned to the
           * bottom-right so the pill's position is stable across cards
           * regardless of body length or attachment count. */}
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            {idea.attachments.length > 0 ? (
              <ul className="flex flex-1 flex-wrap gap-1.5">
                {idea.attachments.map((attachment) => (
                  <li
                    key={attachment.uid}
                    className="inline-flex items-center gap-1 rounded-md bg-fill px-2 py-0.5 text-xs text-ink-soft"
                  >
                    <Paperclip size={12} />
                    {attachment.name}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="flex-1" />
            )}
            <Select<IdeaStatus>
              size="small"
              variant="filled"
              value={idea.status}
              onChange={(next) => onStatusChange(idea.id, next)}
              options={STATUS_OPTIONS}
              aria-label={`Status for ${idea.title}`}
              popupMatchSelectWidth={false}
              disabled={!canMutate}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
