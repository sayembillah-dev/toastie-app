'use client';

import {
  ClipboardText,
  MagnifyingGlass,
  Plus,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { Button, Input } from 'antd';
import { useMemo, useState } from 'react';

import { useCurrentMemberId } from '@/lib/me/current-member';
import { useCan } from '@/lib/permissions/use-can';
import type { Task } from '@/lib/tasks/tasks';
import { useGetAllTasksQuery } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

import { AddTaskDrawer } from './add-task-drawer';
import { TaskCard } from './task-card';
import { TaskDetailDrawer } from './task-detail-drawer';

const GRID_CLASSES = 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

function matchesQuery(task: Task, needle: string): boolean {
  const haystack = `${task.title} ${task.description ?? ''}`.toLowerCase();
  return haystack.includes(needle);
}

/** Open tasks first, done tasks last — `Array.prototype.sort` is stable, so
 * creation order (already newest-first from the API) survives within each
 * half. */
function openFirst(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
}

function TaskGrid({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  return (
    <div className={GRID_CLASSES}>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onOpen={onOpen} />
      ))}
    </div>
  );
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

function DirectorySkeleton() {
  return (
    <div className={GRID_CLASSES} aria-hidden>
      {SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3.5"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-fill-strong" />
          <div className="h-3 w-full animate-pulse rounded bg-fill-strong" />
          <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-fill-strong" />
        </div>
      ))}
    </div>
  );
}

export function TasksDirectory() {
  const { data: tasks, isLoading, isError, error } = useGetAllTasksQuery();
  const myMemberId = useCurrentMemberId();
  const { can } = useCan();
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!tasks) return [];
    return trimmed ? tasks.filter((task) => matchesQuery(task, trimmed)) : tasks;
  }, [tasks, trimmed]);

  const { mine, others } = useMemo(() => {
    const mine: Task[] = [];
    const others: Task[] = [];
    for (const task of filtered) {
      const isMine =
        myMemberId != null &&
        (task.createdBy.id === myMemberId || task.assignees.some((a) => a.id === myMemberId));
      (isMine ? mine : others).push(task);
    }
    return { mine: openFirst(mine), others: openFirst(others) };
  }, [filtered, myMemberId]);

  const canCreate = can('create', 'task');

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Action items officers hand out and track — yours first, then everyone else&rsquo;s.
        </p>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {canCreate ? (
            <Button
              type="primary"
              size="middle"
              icon={<Plus size={16} weight="bold" />}
              onClick={() => setAddOpen(true)}
            >
              New task
            </Button>
          ) : null}
          <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Input
              allowClear
              size="middle"
              placeholder="Search tasks"
              aria-label="Search tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              prefix={<MagnifyingGlass size={16} className="text-ink-muted" />}
              disabled={isLoading}
            />
          </div>
        </div>
      </div>

      {isLoading ? <DirectorySkeleton /> : null}

      {isError ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span
            aria-hidden
            className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <WarningCircle size={18} weight="bold" />
          </span>
          <p className="text-sm font-medium text-ink">Could not load tasks</p>
          <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
            <span
              aria-hidden
              className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
            >
              <ClipboardText size={18} weight="bold" />
            </span>
            {trimmed ? (
              <>
                <p className="text-sm text-ink-soft">
                  No tasks match <span className="font-medium text-ink">&ldquo;{query}&rdquo;</span>
                  .
                </p>
                <p className="mt-1 text-xs text-ink-muted">Try a different word.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-soft">No tasks yet.</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {canCreate
                    ? 'Create one to hand an action item to an officer.'
                    : "An officer hasn't assigned anything yet."}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {mine.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Your tasks
                </h2>
                <TaskGrid tasks={mine} onOpen={setOpenTaskId} />
              </section>
            ) : null}
            {others.length > 0 ? (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  All tasks
                </h2>
                <TaskGrid tasks={others} onOpen={setOpenTaskId} />
              </section>
            ) : null}
          </div>
        )
      ) : null}

      <AddTaskDrawer open={addOpen} onClose={() => setAddOpen(false)} />
      <TaskDetailDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}
