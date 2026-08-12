'use client';

import {
  CheckCircle,
  Circle,
  DotsThreeVertical,
  PencilSimple,
  Plus,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Dropdown, Input, Progress, Skeleton } from 'antd';
import { useState } from 'react';

import { ReadOnlyWhen, useReadOnly } from '@/components/permissions/read-only';
import type { ChecklistItem } from '@/lib/inventory/checklist';
import { CHECKLIST_ITEM_TEXT_MAX } from '@/lib/inventory/checklist';
import {
  useCreateChecklistItemMutation,
  useDeleteChecklistItemMutation,
  useGetChecklistQuery,
  useUpdateChecklistItemMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface MeetingChecklistProps {
  meetingId: string;
  /** Header title. Defaults to the meeting-tab wording; the Inventory surface
   * swaps in something meeting-aware. */
  title?: string;
  /** Subline under the title. */
  subtitle?: string;
  /** When true, ticks and edits are disabled and the menu is hidden — used to
   * present a past meeting's checklist as a read-only archive. */
  readOnly?: boolean;
}

/** The single source of truth for what a meeting's checklist looks like on
 * screen. Both the Meeting tab and the Inventory tab render this — every write
 * flows through the same RTK Query cache entry, so a tick on one surface shows
 * up on the other without a manual refresh. */
export function MeetingChecklist({
  meetingId,
  title = 'Pre-Meeting Checklist',
  subtitle = 'Room setup and prep. Tick each item off before the meeting starts.',
  readOnly: archived = false,
}: MeetingChecklistProps) {
  const { message } = App.useApp();
  /* Two different reasons to be read-only. `archived` is a past meeting —
   * nothing to explain, the affordances just go away. `locked` is permission,
   * which stays on screen and greys out so the tooltip can say why. */
  const locked = useReadOnly('checklist');
  const readOnly = archived || locked;
  const { data: tasks, isLoading, isError, error, refetch } = useGetChecklistQuery(meetingId);
  const [createItem, { isLoading: isCreating }] = useCreateChecklistItemMutation();
  const [updateItem] = useUpdateChecklistItemMutation();
  const [deleteItem] = useDeleteChecklistItemMutation();

  /* Add-in-place uses a client-owned draft rather than an optimistic row so
   * the input stays isolated from the RTK cache — the row lands in the list
   * once the server assigns its id. */
  const [isAdding, setAdding] = useState(false);
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

  if (isError || !tasks) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-dashed border-line-strong bg-canvas p-6 text-center">
          <p className="text-sm font-medium text-ink">Could not load the checklist</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
          <Button className="mt-4" size="small" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  const doneCount = tasks.filter((task) => task.done).length;
  const percent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const canOpenAdd = !readOnly && !isAdding && editingId === null && !isCreating;

  function startEdit(task: ChecklistItem) {
    if (readOnly) return;
    setAdding(false);
    setEditingId(task.id);
    setDraftText(task.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftText('');
  }

  function cancelAdd() {
    setAdding(false);
    setDraftText('');
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      cancelEdit();
      return;
    }
    try {
      await updateItem({ meetingId, itemId: editingId, text: trimmed }).unwrap();
      cancelEdit();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the change'));
    }
  }

  async function saveAdd() {
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      cancelAdd();
      return;
    }
    try {
      await createItem({ meetingId, text: trimmed }).unwrap();
      cancelAdd();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add the item'));
    }
  }

  async function handleToggle(task: ChecklistItem) {
    if (readOnly) return;
    try {
      await updateItem({ meetingId, itemId: task.id, done: !task.done }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update the item'));
    }
  }

  async function handleDelete(taskId: string) {
    if (readOnly) return;
    if (editingId === taskId) cancelEdit();
    try {
      await deleteItem({ meetingId, itemId: taskId }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the item'));
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-xs text-ink-soft">{subtitle}</p>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={`text-xs font-medium ${
                doneCount > 0 ? 'text-emerald-700' : 'text-ink-muted'
              }`}
            >
              {doneCount}/{tasks.length} done
            </div>
          </div>
        </header>

        {tasks.length > 0 && (
          <Progress
            percent={percent}
            showInfo={false}
            size="small"
            strokeColor="#059669"
            className="mb-4"
          />
        )}

        {!archived ? (
          <ReadOnlyWhen readOnly={locked} display="block">
            <div className="mb-3">
              {isAdding ? (
                <div className="rounded-xl border border-line-strong bg-canvas p-3">
                  <div className="flex flex-col gap-2">
                    <Input
                      autoFocus
                      value={draftText}
                      placeholder="What needs doing before the meeting?"
                      maxLength={CHECKLIST_ITEM_TEXT_MAX}
                      onChange={(event) => setDraftText(event.target.value)}
                      onPressEnter={saveAdd}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelAdd();
                        }
                      }}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button size="small" onClick={cancelAdd}>
                        Cancel
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        loading={isCreating}
                        disabled={draftText.trim().length === 0}
                        onClick={saveAdd}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  block
                  size="large"
                  type="dashed"
                  icon={<Plus size={16} weight="bold" />}
                  disabled={!canOpenAdd}
                  onClick={() => {
                    setAdding(true);
                    setDraftText('');
                  }}
                >
                  Add Item
                </Button>
              )}
            </div>
          </ReadOnlyWhen>
        ) : null}

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">Nothing on the checklist</p>
            <p className="mt-1 text-xs text-ink-muted">
              {readOnly
                ? 'No items were logged for this meeting.'
                : 'Use the button above to add the first item.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                readOnly={readOnly}
                locked={locked}
                isEditing={editingId === task.id}
                draftText={draftText}
                onDraftChange={setDraftText}
                onSaveEdit={saveEdit}
                onCancelEdit={cancelEdit}
                onStartEdit={() => startEdit(task)}
                onDelete={() => handleDelete(task.id)}
                onToggle={() => handleToggle(task)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface TaskRowProps {
  task: ChecklistItem;
  readOnly: boolean;
  /** Read-only because of permission rather than because the meeting is
   * archived — the affordance stays visible and explains itself. */
  locked: boolean;
  isEditing: boolean;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function TaskRow({
  task,
  readOnly,
  locked,
  isEditing,
  draftText,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onToggle,
}: TaskRowProps) {
  if (isEditing) {
    return (
      <li className="rounded-xl border border-line-strong bg-canvas p-3">
        <div className="flex flex-col gap-2">
          <Input
            value={draftText}
            autoFocus
            placeholder="What needs doing before the meeting?"
            onChange={(event) => onDraftChange(event.target.value)}
            onPressEnter={onSaveEdit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelEdit();
              }
            }}
            maxLength={CHECKLIST_ITEM_TEXT_MAX}
          />
          <div className="flex items-center justify-end gap-2">
            <Button size="small" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={onSaveEdit}
              disabled={draftText.trim().length === 0}
            >
              Save
            </Button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        task.done ? 'border-emerald-100 bg-emerald-50/70' : 'border-line bg-canvas'
      }`}
    >
      <div className="flex items-center gap-3">
        <ReadOnlyWhen readOnly={locked} display="block" className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onToggle}
            disabled={readOnly}
            aria-pressed={task.done}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
              readOnly ? 'cursor-default' : ''
            }`}
          >
            {task.done ? (
              <CheckCircle size={22} weight="fill" className="shrink-0 text-emerald-600" />
            ) : (
              <Circle size={22} className="shrink-0 text-ink-muted" />
            )}
            <span
              className={`min-w-0 flex-1 text-sm ${
                task.done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink-soft'
              }`}
            >
              {task.text}
            </span>
          </button>
        </ReadOnlyWhen>
        {readOnly && !locked ? null : (
          /* A plain <button> is outside ConfigProvider's reach, so the
           * Dropdown itself has to be told it is disabled. */
          <ReadOnlyWhen readOnly={locked}>
            <Dropdown
              disabled={locked}
              trigger={['click']}
              menu={{
                items: [
                  { key: 'edit', icon: <PencilSimple size={14} />, label: 'Edit' },
                  { key: 'delete', icon: <TrashSimple size={14} />, label: 'Delete', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'edit') onStartEdit();
                  else if (key === 'delete') onDelete();
                },
              }}
            >
              <button
                type="button"
                aria-label="More options"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <DotsThreeVertical size={18} weight="bold" />
              </button>
            </Dropdown>
          </ReadOnlyWhen>
        )}
      </div>
    </li>
  );
}
