import type { Membership, Prisma } from '@prisma/client';

import { type OfficerRole, toOfficerRoles } from '@/memberships';

/** The relations every task read needs — list and detail share one shape,
 * so there's no separate "thin" list row that later needs a second fetch. */
export const taskInclude = {
  createdBy: true,
  doneBy: true,
  assignees: { include: { membership: true } },
  notes: { include: { membership: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export interface TaskPersonWire {
  id: string;
  firstName: string;
  lastName: string;
  roles: OfficerRole[];
}

export interface TaskNoteWire {
  id: string;
  body: string;
  createdAt: string;
  author: TaskPersonWire;
}

/** Wire shape for every task read (list and single). `memberId`-style
 * renames aren't needed here — the DB's `Membership` rows are projected
 * straight into `TaskPersonWire`, same as `MemberWire`. */
export interface TaskWire {
  id: string;
  clubId: string;
  title: string;
  description?: string;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: string;
  done: boolean;
  doneBy?: TaskPersonWire;
  doneAt?: string;
  createdBy: TaskPersonWire;
  assignees: TaskPersonWire[];
  notes: TaskNoteWire[];
  createdAt: string;
}

function toPersonWire(row: Membership): TaskPersonWire {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    roles: toOfficerRoles(row.roles),
  };
}

export function toTaskWire(row: TaskRow): TaskWire {
  const wire: TaskWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    priority: row.priority,
    done: row.done,
    createdBy: toPersonWire(row.createdBy),
    assignees: row.assignees.map((a) => toPersonWire(a.membership)),
    notes: row.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      author: toPersonWire(n.membership),
    })),
    createdAt: row.createdAt.toISOString(),
  };
  if (row.description) wire.description = row.description;
  if (row.dueDate) wire.dueDate = row.dueDate;
  if (row.doneBy) wire.doneBy = toPersonWire(row.doneBy);
  if (row.doneAt) wire.doneAt = row.doneAt.toISOString();
  return wire;
}
