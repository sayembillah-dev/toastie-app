'use client';

import { Eye, ListChecks } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { AgendaPreview } from '@/components/meetings/agenda-preview';
import { AtAGlance } from '@/components/meetings/at-a-glance';
import type { Meeting } from '@/lib/meetings/meetings';

interface OverviewTabProps {
  meeting: Meeting;
}

/** Overview tab — two sub-tabs sitting under the meeting-detail tabs. "At a
 * glance" is the meeting's control panel, and "Agenda" is the printable A4
 * run-of-show. Both read the same meeting draft the other tabs write to. */
export function OverviewTab({ meeting }: OverviewTabProps) {
  return (
    <Tabs
      defaultActiveKey="at-a-glance"
      size="middle"
      items={[
        {
          key: 'at-a-glance',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Eye size={14} weight="bold" />
              At a glance
            </span>
          ),
          children: <AtAGlance meeting={meeting} />,
        },
        {
          key: 'agenda',
          label: (
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={14} weight="bold" />
              Agenda
            </span>
          ),
          children: <AgendaPreview meeting={meeting} />,
        },
      ]}
    />
  );
}
