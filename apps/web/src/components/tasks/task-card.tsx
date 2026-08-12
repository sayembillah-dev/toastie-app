'use client';

import { ChatCircle, CheckCircle, Circle } from '@phosphor-icons/react/dist/ssr';
import { App, Tooltip } from 'antd';
import { ReadOnlyWhen } from '@/components/permissions/read-only';
import { useCurrentMemberId } from '@/lib/me/current-member';
import { useCan } from '@/lib/permissions/use-can';
import { PRIORITY_STYLES, personInitials, personSwatch } from '@/lib/tasks/task-ui';
import type { Task } from '@/lib/tasks/tasks';
import { useUpdateTaskMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const DUE_DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function formatDueDate(iso: string): string {
  return DUE_DATE_FMT.format(new Date(`${iso}T00:00:00`));
}

interface TaskCardProps {
  task: Task;
  onOpen: (taskId: string) => void;
}

export function TaskCard({ task, onOpen }: TaskCardProps) {
  const { message } = App.useApp();
  const myMemberId = useCurrentMemberId();
  const { can } = useCan();
  const [updateTask, { isLoading: isToggling }] = useUpdateTaskMutation();

  const isCreator = myMemberId != null && task.createdBy.id === myMemberId;
  const isAssignee = myMemberId != null && task.assignees.some((a) => a.id === myMemberId);
  const isAdmin = can('update', 'task');
  const canToggle = isCreator || isAssignee || isAdmin;

  async function handleToggle() {
    if (!canToggle || isToggling) return;
    try {
      await updateTask({ taskId: task.id, done: !task.done }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this task'));
    }
  }

  const priority = PRIORITY_STYLES[task.priority];

  // Two sibling buttons, not nested — the done-toggle and the
  // open-detail area both need to be independently clickable, and a
  // `<button>` can't contain another `<button>`.
  return (
    <div className="flex w-full items-start gap-2.5 rounded-xl border border-line bg-canvas p-3.5 transition-colors hover:border-line-strong hover:shadow-sm">
      <ReadOnlyWhen readOnly={!canToggle}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={!canToggle}
          aria-pressed={task.done}
          aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
          className="mt-0.5 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed"
        >
          {task.done ? (
            <CheckCircle size={20} weight="fill" className="text-emerald-600" />
          ) : (
            <Circle size={20} className={canToggle ? 'text-ink-muted' : 'text-ink-muted/50'} />
          )}
        </button>
      </ReadOnlyWhen>

      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="flex min-w-0 flex-1 flex-col gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`text-sm font-semibold ${task.done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'}`}
          >
            {task.title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priority.className}`}
          >
            {priority.label}
          </span>
        </div>
        {task.description ? (
          <p className="-mt-1.5 line-clamp-2 text-xs text-ink-soft">{task.description}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5 text-xs text-ink-muted">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">
              By {task.createdBy.firstName} {task.createdBy.lastName}
            </span>
            {task.dueDate ? <span>· Due {formatDueDate(task.dueDate)}</span> : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {task.notes.length > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <ChatCircle size={13} weight="bold" />
                {task.notes.length}
              </span>
            ) : null}
            {task.assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {task.assignees.slice(0, 4).map((person) => {
                  const swatch = personSwatch(person.id);
                  return (
                    <Tooltip key={person.id} title={`${person.firstName} ${person.lastName}`}>
                      <span
                        aria-hidden
                        className="flex size-5 items-center justify-center rounded-full text-[9px] font-semibold ring-2 ring-canvas"
                        style={{ backgroundColor: swatch.bg, color: swatch.fg }}
                      >
                        {personInitials(person)}
                      </span>
                    </Tooltip>
                  );
                })}
                {task.assignees.length > 4 ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-fill text-[9px] font-semibold text-ink-soft ring-2 ring-canvas">
                    +{task.assignees.length - 4}
                  </span>
                ) : null}
              </div>
            ) : (
              <span className="italic">Unassigned</span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
