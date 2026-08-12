'use client';

import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { App } from 'antd';
import { useMemo } from 'react';
import { AssigneeSelect } from '@/components/education/assignee-select';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Assignee } from '@/lib/education/planner';
import type { Meeting } from '@/lib/meetings/meetings';
import { assigneeToRef, toAssigneeMap } from '@/lib/meetings/role-assignments';
import { buildRoles } from '@/lib/meetings/roles';
import {
  useGetGuestsQuery,
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useSetMeetingRoleMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface RolesTabProps {
  meeting: Meeting;
}

/** Roles tab — a two-column grid of pickers, one per meeting role. Any club
 * member or any guest already in the Guests list can hold a role — the
 * Toastmaster label switches between Day and Evening based on the meeting's
 * scheduled time. Every pick saves immediately — no Save button, matching
 * the Checklist tab's pattern. */
export function RolesTab({ meeting }: RolesTabProps) {
  const { message } = App.useApp();
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const { data: guests, isLoading: guestsLoading } = useGetGuestsQuery();
  const { data: assignmentRows, isLoading: rolesLoading } = useGetMeetingRolesQuery(meeting.id);
  const [setRole] = useSetMeetingRoleMutation();

  const assignments = useMemo(
    () => toAssigneeMap(assignmentRows ?? [], guests ?? []),
    [assignmentRows, guests],
  );
  const roles = useMemo(() => buildRoles(meeting), [meeting]);
  const isLoading = membersLoading || guestsLoading || rolesLoading;

  async function handleAssign(roleKey: string, next: Assignee | null) {
    const ref = assigneeToRef(next);
    try {
      await setRole({ meetingId: meeting.id, roleKey, ...ref }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the assignment'));
    }
  }

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-line bg-canvas p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-ink">Meeting roles</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Assign each meeting role from the club roster or the Guests list. The Toastmaster label
          follows the meeting time — <span className="font-medium text-ink">Day</span> before 5 PM,{' '}
          <span className="font-medium text-ink">Evening</span> after.
        </p>
      </header>

      {/* Single column on phones so each picker gets full width; two columns
       * from `md` up to mirror the layout in the reference. */}
      <ReadOnly resource="meetingRole" display="block">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          {roles.map((role) => {
            const inputId = `role-${role.key}`;
            return (
              <div key={role.key}>
                <label
                  htmlFor={inputId}
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink"
                >
                  <UserCircle size={12} weight="bold" className="text-ink-muted" />
                  {role.label}
                </label>
                <div className="rounded-lg border border-line bg-sidebar px-2">
                  <AssigneeSelect
                    value={assignments[role.key] ?? null}
                    onChange={(next) => handleAssign(role.key, next)}
                    members={members ?? []}
                    guests={guests ?? []}
                    placeholder={isLoading ? 'Loading…' : 'Unassigned'}
                    ariaLabel={role.label}
                    allowFreeformGuest={false}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </ReadOnly>
    </section>
  );
}
