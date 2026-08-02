'use client';

import { Calendar, Path, Users } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { MembersDirectory } from '@/components/education/directory';
import { PlannerTab } from '@/components/education/planner-tab';

/** Tabs live on the Education page so both sections share the same header,
 * breadcrumb and content padding. Each label pairs an icon with the text so
 * the active tab is legible on narrow screens where labels can wrap. */
export function EducationTabs() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Education</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Members and Pathways — everything the VPE needs to run the learning programme.
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
            children: <MembersDirectory />,
          },
          {
            key: 'pathways',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Path size={14} weight="bold" />
                Pathways
              </span>
            ),
            children: null,
          },
          {
            key: 'planner',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} weight="bold" />
                Planner
              </span>
            ),
            children: <PlannerTab />,
          },
        ]}
      />
    </div>
  );
}
