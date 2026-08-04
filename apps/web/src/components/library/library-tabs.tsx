'use client';

import { Calendar, FileText, Package } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { AssetsTab } from '@/components/library/assets-tab';
import { PlannerTab } from '@/components/library/planner-tab';

/** Placeholder shown inside each tab until the section is built out. Kept
 * inline for now — when a tab gets real content it moves to its own file. */
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center text-sm text-ink-soft">
      {label} — coming soon.
    </div>
  );
}

/** Tabs live on the Library page so all sections share the same header,
 * breadcrumb and content padding. */
export function LibraryTabs() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Library</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Planner, assets and documents — the shared reference shelf for the club.
        </p>
      </header>

      <Tabs
        defaultActiveKey="planner"
        size="middle"
        items={[
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
          {
            key: 'assets',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Package size={14} weight="bold" />
                Assets
              </span>
            ),
            children: <AssetsTab />,
          },
          {
            key: 'documents',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <FileText size={14} weight="bold" />
                Documents
              </span>
            ),
            children: <ComingSoon label="Documents" />,
          },
        ]}
      />
    </div>
  );
}
