'use client';

import { CheckCircle, Circle, ClipboardText } from '@phosphor-icons/react/dist/ssr';
import { App, Progress, Skeleton } from 'antd';

import { useGetTasksQuery, useUpdateTaskMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

function formatDueDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Committee/officer action items assigned by name — the "what does the club
 * expect of me this week" list, separate from meeting-scoped SAA checklists. */
export function TasksCard({ memberId }: { memberId: string }) {
  const { message } = App.useApp();
  const { data: tasks, isLoading } = useGetTasksQuery(memberId);
  const [updateTask] = useUpdateTaskMutation();

  async function handleToggle(taskId: string, done: boolean) {
    try {
      await updateTask({ taskId, memberId, done }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this task'));
    }
  }

  const doneCount = tasks?.filter((task) => task.done).length ?? 0;
  const percent = tasks && tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <article className="rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <ClipboardText size={15} weight="bold" className="text-ink-muted" />
          Tasks assigned to you
        </h2>
        {tasks && tasks.length > 0 ? (
          <span className="text-xs font-medium text-ink-muted">
            {doneCount}/{tasks.length}
          </span>
        ) : null}
      </div>

      {tasks && tasks.length > 0 ? (
        <Progress
          percent={percent}
          showInfo={false}
          size="small"
          strokeColor="#059669"
          className="mt-3"
        />
      ) : null}

      {isLoading ? (
        <div className="mt-4">
          <Skeleton active title={false} paragraph={{ rows: 3 }} />
        </div>
      ) : null}

      {!isLoading && tasks && tasks.length === 0 ? (
        <p className="mt-4 text-xs text-ink-muted">Nothing assigned to you right now.</p>
      ) : null}

      {!isLoading && tasks && tasks.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => handleToggle(task.id, !task.done)}
                aria-pressed={task.done}
                className="flex w-full items-start gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {task.done ? (
                  <CheckCircle
                    size={18}
                    weight="fill"
                    className="mt-0.5 shrink-0 text-emerald-600"
                  />
                ) : (
                  <Circle size={18} className="mt-0.5 shrink-0 text-ink-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      task.done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink-muted">
                    {task.assignedBy}
                    {task.dueDate ? ` · Due ${formatDueDate(task.dueDate)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
