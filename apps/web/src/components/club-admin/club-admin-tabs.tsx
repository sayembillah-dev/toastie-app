'use client';

import { ClockCounterClockwise, ShieldCheck, Users } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { AuditTrailTab } from '@/components/club-admin/audit-trail-tab';
import { MembersTab } from '@/components/club-admin/members-tab';
import { PermissionsTab } from '@/components/club-admin/permissions-tab';

/** Root of the Club Admin dashboard — same tabs-on-one-page shell as Finance
 * and Inventory (`finance-tabs.tsx`). Everything an officer with full
 * `clubAdmin` access can do lives in one of these three tabs: manage the
 * roster (members, invites, guest conversion), manage per-module
 * permissions and Club Admin rights, and audit every action taken. */
export function ClubAdminTabs() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Club Admin</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage the roster, module permissions, and Club Admin rights for the whole club.
        </p>
      </header>

      <Tabs
        defaultActiveKey="members"
        size="middle"
        items={[
          {
            key: 'members',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} weight="bold" />
                Members
              </span>
            ),
            children: <MembersTab />,
          },
          {
            key: 'permissions',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={14} weight="bold" />
                Permissions
              </span>
            ),
            children: <PermissionsTab />,
          },
          {
            key: 'audit-trail',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ClockCounterClockwise size={14} weight="bold" />
                Audit Trail
              </span>
            ),
            children: <AuditTrailTab />,
          },
        ]}
      />
    </div>
  );
}
