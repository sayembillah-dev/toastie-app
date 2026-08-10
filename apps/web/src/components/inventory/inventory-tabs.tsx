'use client';

import { CheckSquare, Package } from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';

import { InventoryTab } from '@/components/inventory/inventory-tab';
import { MeetingChecklistTab } from '@/components/inventory/meeting-checklist-tab';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';

/** Tabs live on the Inventory page so both sections share the same header,
 * breadcrumb and content padding. */
export function InventoryTabs() {
  const { activeKey, onChange } = usePersistentTab('tab', 'meeting-checklist');
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Inventory &amp; checklist</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The pre-meeting checklist and the club&rsquo;s physical assets, all in one place.
        </p>
      </header>

      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        size="middle"
        items={[
          {
            key: 'meeting-checklist',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <CheckSquare size={14} weight="bold" />
                Meeting checklist
              </span>
            ),
            children: <MeetingChecklistTab />,
          },
          {
            key: 'inventory',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Package size={14} weight="bold" />
                Inventory
              </span>
            ),
            children: <InventoryTab />,
          },
        ]}
      />
    </div>
  );
}
