import type { Task as TaskRow } from '@prisma/client';

/** Wire shape matches the web `lib/tasks/tasks.ts` `Task` interface.
 * `memberId` on the wire, `membershipId` in the DB. */
export interface TaskWire {
  id: string;
  clubId: string;
  memberId: string;
  title: string;
  assignedBy: string;
  dueDate?: string;
  done: boolean;
  createdAt: string;
}

export function toTaskWire(row: TaskRow): TaskWire {
  const wire: TaskWire = {
    id: row.id,
    clubId: row.clubId,
    memberId: row.membershipId,
    title: row.title,
    assignedBy: row.assignedBy,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.dueDate) wire.dueDate = row.dueDate;
  return wire;
}
