'use client';

import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { App, Select } from 'antd';
import { useMemo } from 'react';
import type { Meeting } from '@/lib/meetings/meetings';
import { toRoleAssignmentMap } from '@/lib/meetings/role-assignments';
import { buildRoles } from '@/lib/meetings/roles';
import {
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useSetMeetingRoleMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

interface RolesTabProps {
  meeting: Meeting;
}

/** Roles tab — a two-column grid of member pickers, one per meeting role. The
 * Toastmaster label switches between Day and Evening based on the meeting's
 * scheduled time. Every pick saves immediately — no Save button, matching
 * the Checklist tab's pattern. */
export function RolesTab({ meeting }: RolesTabProps) {
  const { message } = App.useApp();
  const { data: members, isLoading: membersLoading } = useGetMembersQuery();
  const { data: assignmentRows, isLoading: rolesLoading } = useGetMeetingRolesQuery(meeting.id);
  const [setRole] = useSetMeetingRoleMutation();

  const assignments = useMemo(() => toRoleAssignmentMap(assignmentRows ?? []), [assignmentRows]);
  const roles = useMemo(() => buildRoles(meeting), [meeting]);
  const isLoading = membersLoading || rolesLoading;

  const memberOptions = useMemo(
    () =>
      (members ?? [])
        .map((member) => ({
          value: member.id,
          label: `${member.firstName} ${member.lastName}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [members],
  );

  async function handleAssign(roleKey: string, memberId: string | undefined) {
    try {
      await setRole({ meetingId: meeting.id, roleKey, membershipId: memberId ?? null }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the assignment'));
    }
  }

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-line bg-canvas p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-ink">Meeting roles</h2>
        <p className="mt-1 text-xs text-ink-soft">
          Assign each meeting role from the club roster. The Toastmaster label follows the meeting
          time — <span className="font-medium text-ink">Day</span> before 5 PM,{' '}
          <span className="font-medium text-ink">Evening</span> after.
        </p>
      </header>

      {/* Single column on phones so each picker gets full width; two columns
       * from `md` up to mirror the layout in the reference. */}
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
              <Select
                id={inputId}
                size="large"
                className="w-full"
                placeholder={isLoading ? 'Loading members…' : 'Select a member'}
                value={assignments[role.key]}
                onChange={(value) => handleAssign(role.key, value)}
                options={memberOptions}
                loading={isLoading}
                disabled={isLoading || memberOptions.length === 0}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
