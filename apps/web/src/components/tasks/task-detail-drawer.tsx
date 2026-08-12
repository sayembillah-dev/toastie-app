'use client';

import { CheckCircle, PencilSimple, TrashSimple } from '@phosphor-icons/react/dist/ssr';
import { App, Button, Drawer, Form, Input, Popconfirm, Segmented, Select, Skeleton } from 'antd';
import { useMemo, useState } from 'react';

import { ReadOnlyWhen } from '@/components/permissions/read-only';
import { useCurrentMemberId } from '@/lib/me/current-member';
import { useCan } from '@/lib/permissions/use-can';
import { officerOptions, PRIORITY_STYLES, personInitials, personSwatch } from '@/lib/tasks/task-ui';
import {
  TASK_DESCRIPTION_MAX,
  TASK_NOTE_MAX,
  TASK_TITLE_MAX,
  type TaskPriority,
} from '@/lib/tasks/tasks';
import {
  useAddTaskNoteMutation,
  useDeleteTaskMutation,
  useGetAllTasksQuery,
  useGetMembersQuery,
  useUpdateTaskMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const { TextArea } = Input;

const NOTE_DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
}

interface EditFormValues {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeMembershipIds: string[];
}

/** View, edit, complete, delete, and comment on one task. Reads off the
 * already-fetched `getAllTasks` cache rather than a dedicated detail
 * endpoint — there isn't one; every field the drawer needs is already in
 * the list row. Every write re-hits the server, which is the actual
 * authority on who's allowed to do what — the buttons below are hidden
 * accordingly, but a 403 falls back to a toast rather than a broken UI. */
export function TaskDetailDrawer({ taskId, onClose }: TaskDetailDrawerProps) {
  const { message } = App.useApp();
  const { data: tasks, isLoading: tasksLoading } = useGetAllTasksQuery();
  const task = useMemo(() => tasks?.find((t) => t.id === taskId) ?? null, [tasks, taskId]);

  const { data: members } = useGetMembersQuery();
  const officers = useMemo(() => officerOptions(members ?? []), [members]);

  const myMemberId = useCurrentMemberId();
  const { can } = useCan();

  const [form] = Form.useForm<EditFormValues>();
  const [editing, setEditing] = useState(false);
  const [noteBody, setNoteBody] = useState('');

  const [updateTask, { isLoading: isSaving }] = useUpdateTaskMutation();
  const [deleteTask, { isLoading: isDeleting }] = useDeleteTaskMutation();
  const [addNote, { isLoading: isAddingNote }] = useAddTaskNoteMutation();

  // Reset the edit/note state whenever a different task opens — done during
  // render (comparing against the last-seen id), not in an effect, so it
  // can't trigger a second cascading render.
  const [lastTaskId, setLastTaskId] = useState(taskId);
  if (taskId !== lastTaskId) {
    setLastTaskId(taskId);
    setEditing(false);
    setNoteBody('');
  }

  const isCreator = task != null && myMemberId != null && task.createdBy.id === myMemberId;
  const isAssignee =
    task != null && myMemberId != null && task.assignees.some((a) => a.id === myMemberId);
  const isAdmin = can('update', 'task');
  const canEditStructure = isCreator || isAdmin;
  const canDelete = isCreator || isAdmin;
  const canToggleDone = isCreator || isAssignee || isAdmin;
  const canAddNote = isCreator || isAssignee || isAdmin;

  function startEditing() {
    if (!task) return;
    form.setFieldsValue({
      title: task.title,
      description: task.description,
      priority: task.priority,
      assigneeMembershipIds: task.assignees.map((a) => a.id),
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!task) return;
    let values: EditFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await updateTask({
        taskId: task.id,
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        priority: values.priority,
        assigneeMembershipIds: values.assigneeMembershipIds,
      }).unwrap();
      message.success('Task updated');
      setEditing(false);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  }

  async function handleToggleDone() {
    if (!task) return;
    try {
      await updateTask({ taskId: task.id, done: !task.done }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update this task'));
    }
  }

  async function handleDelete() {
    if (!task) return;
    try {
      await deleteTask(task.id).unwrap();
      message.success('Task deleted');
      onClose();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete this task'));
    }
  }

  async function handleAddNote() {
    if (!task || !noteBody.trim()) return;
    try {
      await addNote({ taskId: task.id, body: noteBody.trim() }).unwrap();
      setNoteBody('');
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not add that note'));
    }
  }

  return (
    <Drawer
      open={taskId != null}
      onClose={onClose}
      placement="right"
      size="min(520px, 100vw)"
      title={editing ? 'Edit task' : 'Task'}
      styles={{ body: { paddingTop: 20, paddingBottom: 20 } }}
      footer={
        task && !editing ? (
          <div className="flex items-center justify-between gap-2">
            <ReadOnlyWhen readOnly={!canDelete}>
              <Popconfirm
                title="Delete this task?"
                description="This can't be undone."
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={handleDelete}
              >
                <Button danger icon={<TrashSimple size={15} weight="bold" />} loading={isDeleting}>
                  Delete
                </Button>
              </Popconfirm>
            </ReadOnlyWhen>
            <div className="flex items-center gap-2">
              <ReadOnlyWhen readOnly={!canEditStructure}>
                <Button icon={<PencilSimple size={15} weight="bold" />} onClick={startEditing}>
                  Edit
                </Button>
              </ReadOnlyWhen>
              <ReadOnlyWhen readOnly={!canToggleDone}>
                <Button
                  type="primary"
                  icon={<CheckCircle size={15} weight="bold" />}
                  loading={isSaving}
                  onClick={handleToggleDone}
                >
                  {task.done ? 'Reopen' : 'Mark done'}
                </Button>
              </ReadOnlyWhen>
            </div>
          </div>
        ) : editing ? (
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="primary" loading={isSaving} onClick={handleSaveEdit}>
              Save changes
            </Button>
          </div>
        ) : null
      }
    >
      {tasksLoading && !task ? <Skeleton active paragraph={{ rows: 4 }} /> : null}

      {!tasksLoading && !task ? (
        <p className="text-sm text-ink-soft">This task no longer exists.</p>
      ) : null}

      {task && editing ? (
        <Form form={form} layout="vertical" requiredMark="optional" disabled={isSaving}>
          <Form.Item
            label="Title"
            name="title"
            rules={[
              { required: true, whitespace: true, message: 'Give the task a title' },
              { max: TASK_TITLE_MAX, message: `Keep it under ${TASK_TITLE_MAX} characters` },
            ]}
          >
            <Input maxLength={TASK_TITLE_MAX} />
          </Form.Item>
          <Form.Item
            label="Description"
            name="description"
            rules={[{ max: TASK_DESCRIPTION_MAX, message: 'That description is too long' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Priority" name="priority">
            <Segmented
              options={[
                { label: 'Low', value: 'Low' },
                { label: 'Medium', value: 'Medium' },
                { label: 'High', value: 'High' },
              ]}
              block
            />
          </Form.Item>
          <Form.Item label="Assigned to" name="assigneeMembershipIds" className="!mb-0">
            <Select
              mode="multiple"
              options={officers}
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Search officers…"
            />
          </Form.Item>
        </Form>
      ) : null}

      {task && !editing ? (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2
                className={`text-base font-semibold ${task.done ? 'text-ink-muted line-through decoration-ink-muted/50' : 'text-ink'}`}
              >
                {task.title}
              </h2>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[task.priority].className}`}
              >
                {PRIORITY_STYLES[task.priority].label}
              </span>
            </div>
            {task.description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{task.description}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-fill/40 p-3 text-xs">
            <div>
              <div className="font-medium uppercase tracking-wide text-ink-muted">Created by</div>
              <div className="mt-1 text-ink">
                {task.createdBy.firstName} {task.createdBy.lastName}
              </div>
            </div>
            <div>
              <div className="font-medium uppercase tracking-wide text-ink-muted">Status</div>
              <div className="mt-1 text-ink">
                {task.done && task.doneBy
                  ? `Done by ${task.doneBy.firstName} ${task.doneBy.lastName}`
                  : task.done
                    ? 'Done'
                    : 'Open'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              Assigned to
            </div>
            {task.assignees.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {task.assignees.map((person) => {
                  const swatch = personSwatch(person.id);
                  return (
                    <span
                      key={person.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-1 pr-2.5 text-xs text-ink"
                    >
                      <span
                        aria-hidden
                        className="flex size-5 items-center justify-center rounded-full text-[9px] font-semibold"
                        style={{ backgroundColor: swatch.bg, color: swatch.fg }}
                      >
                        {personInitials(person)}
                      </span>
                      {person.firstName} {person.lastName}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 text-sm italic text-ink-muted">Nobody yet.</p>
            )}
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notes</div>
            {task.notes.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-3">
                {task.notes.map((note) => (
                  <li key={note.id} className="rounded-lg border border-line bg-canvas p-2.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                      <span className="font-medium text-ink-soft">
                        {note.author.firstName} {note.author.lastName}
                      </span>
                      <span>{NOTE_DATE_FMT.format(new Date(note.createdAt))}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{note.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm italic text-ink-muted">No notes yet.</p>
            )}

            <ReadOnlyWhen readOnly={!canAddNote} display="block">
              <div className="mt-3 flex w-full flex-col gap-2">
                <TextArea
                  rows={2}
                  maxLength={TASK_NOTE_MAX}
                  placeholder="Add a progress note…"
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                />
                <Button
                  size="small"
                  className="self-end"
                  loading={isAddingNote}
                  disabled={!noteBody.trim()}
                  onClick={handleAddNote}
                >
                  Add note
                </Button>
              </div>
            </ReadOnlyWhen>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
