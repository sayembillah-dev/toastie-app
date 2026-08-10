'use client';

import { AccessGate } from '@/components/permissions/access-gate';

import { TasksDirectory } from './tasks-directory';

export function TasksScreen() {
  return (
    <AccessGate resource="task">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5">
          <h1 className="text-xl font-semibold text-ink">Tasks</h1>
        </div>
        <TasksDirectory />
      </div>
    </AccessGate>
  );
}
