'use client';

import { Paperclip, Plus, Trash } from '@phosphor-icons/react/dist/ssr';
import type { UploadFile } from 'antd';
import { Button, Input, Select, Typography, Upload } from 'antd';
import { useState } from 'react';

const { TextArea } = Input;
const { Paragraph } = Typography;

/** Rows shown before the body clamps and offers a "See more" toggle. Three
 * lines feels roughly like a card preview without dominating the list. */
const BODY_CLAMP_ROWS = 3;

export type IdeaStatus = 'created' | 'drafted' | 'published';

export interface IdeaAttachment {
  uid: string;
  name: string;
}

export interface Idea {
  id: string;
  title: string;
  body: string;
  attachments: IdeaAttachment[];
  status: IdeaStatus;
}

/** Ordered so the Select dropdown reads as a progression: fresh → in
 * progress → shipped. Dot tones are Tailwind defaults so the palette isn't
 * dependent on a status token that doesn't yet exist in the theme. */
const STATUS_META: Record<IdeaStatus, { label: string; dot: string }> = {
  created: { label: 'Created', dot: 'bg-slate-400' },
  drafted: { label: 'Drafted', dot: 'bg-amber-500' },
  published: { label: 'Published', dot: 'bg-emerald-500' },
};
const STATUS_ORDER: IdeaStatus[] = ['created', 'drafted', 'published'];

function StatusOptionLabel({ status }: { status: IdeaStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

const STATUS_OPTIONS = STATUS_ORDER.map((status) => ({
  value: status,
  label: <StatusOptionLabel status={status} />,
}));

interface PlannerDayPanelProps {
  ideas: Idea[];
  /* Form supplies the mutable fields; parent stamps id + initial status so
   * the panel stays agnostic of persistence and defaulting concerns. */
  onAdd: (idea: Omit<Idea, 'id' | 'status'>) => void;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: IdeaStatus) => void;
}

/** Right-drawer body for a selected day. Two modes: a list of ideas with an
 * Add button, and an inline form that collapses back to the list on save or
 * cancel. The parent owns the ideas array so state survives day switches. */
export function PlannerDayPanel({ ideas, onAdd, onRemove, onStatusChange }: PlannerDayPanelProps) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {adding ? (
        <IdeaForm
          onSave={(idea) => {
            onAdd(idea);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button block icon={<Plus size={14} />} onClick={() => setAdding(true)}>
          Add idea
        </Button>
      )}

      <IdeasList ideas={ideas} onRemove={onRemove} onStatusChange={onStatusChange} />
    </div>
  );
}

interface IdeaFormProps {
  onSave: (idea: Omit<Idea, 'id' | 'status'>) => void;
  onCancel: () => void;
}

/** Inline card form. Attachments are captured locally — `beforeUpload`
 * returns `false` so antd never posts them anywhere; only the file names
 * are snapshotted into the idea on save. */
function IdeaForm({ onSave, onCancel }: IdeaFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: trimmedTitle,
      body: body.trim(),
      attachments: fileList.map((file) => ({ uid: file.uid, name: file.name })),
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-fill/40 p-3">
      <Input
        placeholder="Idea title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        autoFocus
      />
      <TextArea
        placeholder="Notes"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        autoSize={{ minRows: 3, maxRows: 8 }}
      />
      <Upload
        multiple
        beforeUpload={() => false}
        fileList={fileList}
        onChange={(info) => setFileList(info.fileList)}
      >
        <Button size="small" icon={<Paperclip size={14} />}>
          Attach files
        </Button>
      </Upload>
      <div className="mt-1 flex justify-end gap-2">
        <Button size="small" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="small" type="primary" disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}

interface IdeasListProps {
  ideas: Idea[];
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: IdeaStatus) => void;
}

function IdeasList({ ideas, onRemove, onStatusChange }: IdeasListProps) {
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
            <Button
              type="text"
              size="small"
              aria-label={`Delete idea ${idea.title}`}
              icon={<Trash size={14} className="text-ink-muted" />}
              onClick={() => onRemove(idea.id)}
            />
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
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
