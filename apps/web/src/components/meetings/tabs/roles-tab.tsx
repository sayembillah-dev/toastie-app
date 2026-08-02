'use client';

import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { Select } from 'antd';
import { useMemo } from 'react';

import type { Meeting } from '@/lib/meetings/meetings';
import { buildRoles } from '@/lib/meetings/roles';
import { useGetMembersQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { roleAssigned, selectMeetingDraft } from '@/store/meeting-draft-slice';

interface RolesTabProps {
  meeting: Meeting;
}

/** Roles tab — a two-column grid of member pickers, one per meeting role. The
 * Toastmaster label switches between Day and Evening based on the meeting's
 * scheduled time. Assignments land in the meeting draft, so the Overview →
 * Agenda sheet names the same people. */
export function RolesTab({ meeting }: RolesTabProps) {
  const { data: members, isLoading } = useGetMembersQuery();
  const dispatch = useAppDispatch();
  const assignments = useAppSelector((state) => selectMeetingDraft(state, meeting.id)).roles;

  const roles = useMemo(() => buildRoles(meeting), [meeting]);

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

  function handleAssign(roleKey: string, memberId: string | undefined) {
    dispatch(roleAssigned({ meetingId: meeting.id, roleKey, memberId }));
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
