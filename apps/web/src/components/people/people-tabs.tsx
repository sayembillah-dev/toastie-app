'use client';

import { UserCircle, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { MembersDirectory } from '@/components/education/directory';
import { GuestsDirectory } from '@/components/people/guests-directory';

/** People hub — two tabs sharing the same header. Guests lists visitors so we
 * can follow up; Members reuses the education directory grid so the roster
 * stays a single source of truth. */
export function PeopleTabs() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">People</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Everyone the club has met — the members who show up week after week and the guests we hope
          to see back.
        </p>
      </header>

      <Tabs
        defaultActiveKey="guests"
        size="middle"
        items={[
          {
            key: 'guests',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <UserCircle size={14} weight="bold" />
                Guests
              </span>
            ),
            children: <GuestsDirectory />,
          },
          {
            key: 'members',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <UsersThree size={14} weight="bold" />
                Members
              </span>
            ),
            children: <MembersDirectory variant="engagement" />,
          },
        ]}
      />
    </div>
  );
}
