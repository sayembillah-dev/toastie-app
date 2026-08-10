import type { OfficerRole } from '@/lib/education/members';

/** A club officer action item — optionally assigned to one or more
 * officers, closed out by any one of them. Distinct from `ChecklistItem`,
 * which is meeting-scoped SAA prep rather than a standalone to-do. */

export const TASK_TITLE_MAX = 120;
export const TASK_DESCRIPTION_MAX = 2000;
export const TASK_NOTE_MAX = 1000;

export const TASK_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskPerson {
  id: string;
  firstName: string;
  lastName: string;
  roles: OfficerRole[];
}

export interface TaskNote {
  id: string;
  body: string;
  createdAt: string;
  author: TaskPerson;
}

export interface Task {
  id: string;
  /** Tenant boundary — the club the task belongs to. */
  clubId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  done: boolean;
  doneBy?: TaskPerson;
  doneAt?: string;
  createdBy: TaskPerson;
  assignees: TaskPerson[];
  notes: TaskNote[];
  createdAt: string;
}

/** Body for `POST /tasks`. */
export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeMembershipIds: string[];
}

/** Body for `PATCH /tasks/:taskId`. Every field optional — the server
 * decides what the caller is allowed to touch (see `tasks.service.ts` on
 * the API side): editing title/description/priority/assignees is the
 * creator's call, toggling `done` can also come from any assignee. */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeMembershipIds?: string[];
  done?: boolean;
}

export interface CreateTaskNoteInput {
  body: string;
}
