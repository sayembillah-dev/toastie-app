'use client';

import {
  CheckCircle,
  Circle,
  DotsThreeVertical,
  PencilSimple,
  Plus,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Dropdown, Input } from 'antd';
import { useState } from 'react';

const MAX_QUESTIONS = 10;

interface Question {
  id: string;
  /** Body of the topic — new lines survive to become follow-up prompts under
   * the main question when the row renders. */
  text: string;
  asked: boolean;
}

interface QuestionRowProps {
  number: number;
  question: Question;
  isEditing: boolean;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAsked: () => void;
}

function NumberBadge({ n, asked }: { n: number; asked: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        asked ? 'bg-emerald-100 text-emerald-800' : 'bg-fill text-ink-soft'
      }`}
    >
      {n}
    </span>
  );
}

function QuestionRow({
  number,
  question,
  isEditing,
  draftText,
  onDraftChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  onToggleAsked,
}: QuestionRowProps) {
  if (isEditing) {
    return (
      <li className="rounded-xl border border-line-strong bg-canvas p-3">
        <div className="flex items-start gap-3">
          <NumberBadge n={number} asked={false} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input.TextArea
              value={draftText}
              autoFocus
              placeholder="Write the question. Use new lines for follow-ups."
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                /* Cmd/Ctrl + Enter saves; plain Enter still inserts a
                 * newline so follow-up prompts are natural to add. */
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault();
                  onSave();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  onCancel();
                }
              }}
              autoSize={{ minRows: 2, maxRows: 6 }}
              maxLength={400}
            />
            <div className="flex items-center justify-end gap-2">
              <Button size="small" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={onSave}
                disabled={draftText.trim().length === 0}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        question.asked ? 'border-emerald-100 bg-emerald-50/70' : 'border-line bg-canvas'
      }`}
    >
      <div className="flex items-start gap-3">
        <NumberBadge n={number} asked={question.asked} />
        <div
          className={`min-w-0 flex-1 whitespace-pre-line text-sm ${
            question.asked ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink-soft'
          }`}
        >
          {question.text}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleAsked}
            aria-label={question.asked ? 'Mark as not asked' : 'Mark as asked'}
            aria-pressed={question.asked}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            {question.asked ? (
              <CheckCircle size={22} weight="fill" className="text-emerald-600" />
            ) : (
              <Circle size={22} className="text-ink-muted" />
            )}
          </button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'edit', icon: <PencilSimple size={14} />, label: 'Edit' },
                {
                  key: 'delete',
                  icon: <TrashSimple size={14} />,
                  label: 'Delete',
                  danger: true,
                },
              ],
              onClick: ({ key }) => {
                if (key === 'edit') onEdit();
                else if (key === 'delete') onDelete();
              },
            }}
          >
            <button
              type="button"
              aria-label="More options"
              className="flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>
          </Dropdown>
        </div>
      </div>
    </li>
  );
}

/** Table Topics tab — a numbered question bank capped at MAX_QUESTIONS. The
 * Table Topics master can add, edit, delete, and mark questions as asked
 * during the meeting. Add sits at the top so it's always in reach on long
 * lists. Questions persist to local state for now. */
export function TableTopicsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');

  const askedCount = questions.filter((question) => question.asked).length;
  const canAdd = questions.length < MAX_QUESTIONS && editingId === null;

  function handleAdd() {
    if (!canAdd) return;
    const id = crypto.randomUUID();
    setQuestions((prev) => [...prev, { id, text: '', asked: false }]);
    setEditingId(id);
    setDraftText('');
  }

  function handleStartEdit(question: Question) {
    setEditingId(question.id);
    setDraftText(question.text);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      /* Saving an empty draft is the same as cancelling on a fresh row —
       * remove blank additions, keep existing questions unchanged. */
      handleCancelEdit();
      return;
    }
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === editingId ? { ...question, text: trimmed } : question,
      ),
    );
    setEditingId(null);
    setDraftText('');
  }

  function handleCancelEdit() {
    /* If the row was newly added it has an empty saved text — drop it. Rows
     * being re-edited keep their previous text, so they survive the filter. */
    setQuestions((prev) =>
      prev.filter((question) => question.id !== editingId || question.text.length > 0),
    );
    setEditingId(null);
    setDraftText('');
  }

  function handleDelete(id: string) {
    setQuestions((prev) => prev.filter((question) => question.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraftText('');
    }
  }

  function handleToggleAsked(id: string) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? { ...question, asked: !question.asked } : question,
      ),
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Table Topic Questions</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Up to {MAX_QUESTIONS} questions. Mark each as asked during the meeting.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-medium text-ink-muted">
              {questions.length}/{MAX_QUESTIONS}
            </div>
            <div
              className={`mt-0.5 text-xs font-medium ${
                askedCount > 0 ? 'text-emerald-700' : 'text-ink-muted'
              }`}
            >
              {askedCount} asked
            </div>
          </div>
        </header>

        {/* Add lives above the list so it's always one tap away on long
         * meeting nights — no scrolling to the end to append the 8th topic. */}
        <div className="mb-3">
          <Button
            block
            size="large"
            type="dashed"
            icon={<Plus size={16} weight="bold" />}
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">No questions yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Use the button above to add the first question.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {questions.map((question, index) => (
              <QuestionRow
                key={question.id}
                number={index + 1}
                question={question}
                isEditing={editingId === question.id}
                draftText={draftText}
                onDraftChange={setDraftText}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                onEdit={() => handleStartEdit(question)}
                onDelete={() => handleDelete(question.id)}
                onToggleAsked={() => handleToggleAsked(question.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
