/** A committee or officer action item assigned to one member by name — distinct
 * from `ChecklistItem`, which is meeting-scoped SAA prep rather than a
 * personal to-do. */

export const TASK_TITLE_MAX = 120;

export interface Task {
  id: string;
  memberId: string;
  title: string;
  /** Free-text "who asked" — a role and a name, e.g. "SAA · Yara Ibrahim". */
  assignedBy: string;
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

/** Body for `PATCH /tasks/:taskId`. Toggling done is the only edit the Me
 * page needs — assignment itself happens wherever the officer works. */
export interface UpdateTaskInput {
  done: boolean;
}

export const SEED_TASKS: Task[] = [
  {
    id: 'task-m-01-1',
    memberId: 'm-01',
    title: "Submit President's note for the August newsletter",
    assignedBy: 'VPPR · Daniel Ortiz',
    dueDate: '2026-08-10',
    done: false,
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'task-m-01-2',
    memberId: 'm-01',
    title: 'Confirm judges for the Humorous Speech contest',
    assignedBy: 'SAA · Yara Ibrahim',
    dueDate: '2026-08-15',
    done: false,
    createdAt: '2026-08-02T09:00:00.000Z',
  },
  {
    id: 'task-m-01-3',
    memberId: 'm-01',
    title: 'Review and sign off the Q3 budget',
    assignedBy: 'Treasurer · Nathan Brooks',
    dueDate: '2026-08-07',
    done: true,
    createdAt: '2026-07-29T09:00:00.000Z',
  },
];
