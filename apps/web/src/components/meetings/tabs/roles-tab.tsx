'use client';

import { UserCircle } from '@phosphor-icons/react/dist/ssr';
import { Select } from 'antd';
import { useMemo, useState } from 'react';

import type { Meeting } from '@/lib/meetings/meetings';
import { useGetMembersQuery } from '@/store/api';

/** Toastmasters convention: meetings at or after 5 PM are Evening events, and
 * everything earlier reads as "of the Day". A single cutoff keeps the label
 * decision testable without a config knob. */
function getToastmasterLabel(dateTime: string): string {
  const hour = new Date(dateTime).getHours();
  return hour >= 17 ? 'Toast Master of the Evening' : 'Toast Master of the Day';
}

interface RoleDef {
  key: string;
  label: string;
}

function buildRoles(meeting: Meeting): RoleDef[] {
  return [
    { key: 'president', label: 'President' },
    { key: 'sergeant-at-arms', label: 'Sergeant at Arms' },
    { key: 'toastmaster', label: getToastmasterLabel(meeting.dateTime) },
    { key: 'general-evaluator', label: 'General Evaluator' },
    { key: 'table-topic-master', label: 'Table Topic Master' },
    { key: 'table-topic-evaluator', label: 'Table Topic Evaluator' },
    { key: 'ah-counter', label: 'Ah Counter' },
    { key: 'timer', label: 'Timer' },
    { key: 'grammarian', label: 'Grammarian' },
  ];
}

interface RolesTabProps {
  meeting: Meeting;
}

/** Roles tab — a two-column grid of member pickers, one per meeting role. The
 * Toastmaster label switches between Day and Evening based on the meeting's
 * scheduled time. Assignments live in local state for now. */
export function RolesTab({ meeting }: RolesTabProps) {
  const { data: members, isLoading } = useGetMembersQuery();
  const [assignments, setAssignments] = useState<Record<string, string | undefined>>({});

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
    setAssignments((prev) => ({ ...prev, [roleKey]: memberId }));
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
