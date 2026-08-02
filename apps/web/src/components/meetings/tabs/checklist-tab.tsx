'use client';

import {
  CheckCircle,
  Circle,
  DotsThreeVertical,
  PencilSimple,
  Plus,
  TrashSimple,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Dropdown, Input, Progress } from 'antd';
import { useState } from 'react';

/** Room-setup tasks the club runs through before every meeting. Users can add,
 * edit and remove entries after mount — this is just the starting set. */
const DEFAULT_TASKS = [
  'Arrange chairs and tables',
  'Display the club banner',
  'Print Agenda and others documents',
  'Gather Time Ballots',
  'Food for the guests',
];

interface Task {
  id: string;
  text: string;
  done: boolean;
}

function createDefaultTasks(): Task[] {
  return DEFAULT_TASKS.map((text) => ({ id: crypto.randomUUID(), text, done: false }));
}

interface TaskRowProps {
  task: Task;
  isEditing: boolean;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDone: () => void;
}

function TaskRow({
  task,
  isEditing,
  draftText,
  onDraftChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
  onToggleDone,
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
            onPressEnter={onSave}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            maxLength={120}
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
        {/* The whole label is the hit target — checklists get tapped in a
         * hurry while the room is being set up. */}
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={task.done}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
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
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'edit', icon: <PencilSimple size={14} />, label: 'Edit' },
              { key: 'delete', icon: <TrashSimple size={14} />, label: 'Delete', danger: true },
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
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
        </Dropdown>
      </div>
    </li>
  );
}

/** Checklist tab — the pre-meeting setup list. Seeded with the club's standard
 * tasks; the SAA can add, edit, delete and tick them off on the night. Tasks
 * live in local state for now, like the other run-of-show tabs. */
export function ChecklistTab() {
  /* Lazy initializer: `crypto.randomUUID()` must not run on the server, and
   * re-running it every render would remint the ids under React's keys. */
  const [tasks, setTasks] = useState<Task[]>(createDefaultTasks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');

  const doneCount = tasks.filter((task) => task.done).length;
  const percent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const canAdd = editingId === null;

  function handleAdd() {
    if (!canAdd) return;
    const id = crypto.randomUUID();
    setTasks((prev) => [...prev, { id, text: '', done: false }]);
    setEditingId(id);
    setDraftText('');
  }

  function handleStartEdit(task: Task) {
    setEditingId(task.id);
    setDraftText(task.text);
  }

  function handleSaveEdit() {
    if (!editingId) return;
    const trimmed = draftText.trim();
    if (trimmed.length === 0) {
      /* Saving an empty draft is the same as cancelling on a fresh row —
       * remove blank additions, keep existing tasks unchanged. */
      handleCancelEdit();
      return;
    }
    setTasks((prev) =>
      prev.map((task) => (task.id === editingId ? { ...task, text: trimmed } : task)),
    );
    setEditingId(null);
    setDraftText('');
  }

  function handleCancelEdit() {
    /* Newly added rows still have empty saved text — drop them. Rows being
     * re-edited keep their previous text, so they survive the filter. */
    setTasks((prev) => prev.filter((task) => task.id !== editingId || task.text.length > 0));
    setEditingId(null);
    setDraftText('');
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraftText('');
    }
  }

  function handleToggleDone(id: string) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-line bg-canvas p-4 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Pre-Meeting Checklist</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Room setup and prep. Tick each item off before the meeting starts.
            </p>
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

        {/* Add sits above the list so it stays in reach as the list grows. */}
        <div className="mb-3">
          <Button
            block
            size="large"
            type="dashed"
            icon={<Plus size={16} weight="bold" />}
            disabled={!canAdd}
            onClick={handleAdd}
          >
            Add Item
          </Button>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">Nothing on the checklist</p>
            <p className="mt-1 text-xs text-ink-muted">
              Use the button above to add the first item.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isEditing={editingId === task.id}
                draftText={draftText}
                onDraftChange={setDraftText}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                onEdit={() => handleStartEdit(task)}
                onDelete={() => handleDelete(task.id)}
                onToggleDone={() => handleToggleDone(task.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
