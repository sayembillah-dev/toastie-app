'use client';

import {
  CheckCircle,
  Circle,
  DotsThreeVertical,
  PencilSimple,
  Plus,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Skeleton } from 'antd';
import { useState } from 'react';
import { ReadOnly } from '@/components/permissions/read-only';
import type { TableTopicQuestion } from '@/lib/meetings/table-topics';
import { MAX_TABLE_TOPIC_QUESTIONS, TABLE_TOPIC_TEXT_MAX } from '@/lib/meetings/table-topics';
import {
  useCreateTableTopicQuestionMutation,
  useDeleteTableTopicQuestionMutation,
  useGetTableTopicsQuery,
  useUpdateTableTopicQuestionMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/** Sentinel `editingId` for a question that hasn't been created yet — the Add
 * flow opens the editor first and only calls `create` once there's real text
 * to save, so every row in the list is already persisted. */
const NEW_QUESTION = 'new';

interface QuestionRowProps {
  number: number;
  question: TableTopicQuestion;
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
              maxLength={TABLE_TOPIC_TEXT_MAX}
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

interface TableTopicsTabProps {
  meetingId: string;
}

/** Table Topics tab — a numbered question bank capped at
 * `MAX_TABLE_TOPIC_QUESTIONS`. The Table Topics master can add, edit,
 * delete, and mark questions as asked during the meeting. Every change
 * saves immediately — no Save button, matching the Checklist tab. */
export function TableTopicsTab({ meetingId }: TableTopicsTabProps) {
  const { message } = App.useApp();
  const { data: questions, isLoading, isError, error, refetch } = useGetTableTopicsQuery(meetingId);
  const [createQuestion, { isLoading: isCreating }] = useCreateTableTopicQuestionMutation();
  const [updateQuestion] = useUpdateTableTopicQuestionMutation();
  const [deleteQuestion] = useDeleteTableTopicQuestionMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');

  if (isLoading) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
          <Skeleton active title paragraph={{ rows: 4 }} />
        </div>
      </section>
    );
  }

  if (isError || !questions) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center">
          <p className="text-sm font-medium text-ink">Could not load the questions</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const askedCount = questions.filter((question) => question.asked).length;
  const canAdd = questions.length < MAX_TABLE_TOPIC_QUESTIONS && editingId === null && !isCreating;

  function handleAdd() {
    if (!canAdd) return;
    setEditingId(NEW_QUESTION);
    setDraftText('');
  }

  function handleStartEdit(question: TableTopicQuestion) {
    setEditingId(question.id);
    setDraftText(question.text);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setDraftText('');
  }

  async function handleSaveEdit() {
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      handleCancelEdit();
      return;
    }
    try {
      if (editingId === NEW_QUESTION) {
        await createQuestion({ meetingId, text: trimmed }).unwrap();
      } else if (editingId) {
        await updateQuestion({ meetingId, itemId: editingId, text: trimmed }).unwrap();
      }
      handleCancelEdit();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the question'));
    }
  }

  async function handleDelete(id: string) {
    if (editingId === id) handleCancelEdit();
    try {
      await deleteQuestion({ meetingId, itemId: id }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the question'));
    }
  }

  async function handleToggleAsked(question: TableTopicQuestion) {
    try {
      await updateQuestion({ meetingId, itemId: question.id, asked: !question.asked }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update the question'));
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      {/* Panel chrome (border/surface/padding) starts at `md` — on phones
       * this renders inside the full-width drawer, which already provides
       * both. */}
      <div className="md:rounded-2xl md:border md:border-line md:bg-canvas md:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Table Topic Questions</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Up to {MAX_TABLE_TOPIC_QUESTIONS} questions. Mark each as asked during the meeting.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-medium text-ink-muted">
              {questions.length}/{MAX_TABLE_TOPIC_QUESTIONS}
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

        <ReadOnly resource="tableTopic" display="block">
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

          {editingId === NEW_QUESTION ? (
            <ul className="mb-2 flex flex-col gap-2">
              <QuestionRow
                number={questions.length + 1}
                question={{ id: NEW_QUESTION, text: '', asked: false }}
                isEditing
                draftText={draftText}
                onDraftChange={setDraftText}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggleAsked={() => {}}
              />
            </ul>
          ) : null}

          {questions.length === 0 && editingId !== NEW_QUESTION ? (
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
                  onToggleAsked={() => handleToggleAsked(question)}
                />
              ))}
            </ul>
          )}
        </ReadOnly>
      </div>
    </section>
  );
}
