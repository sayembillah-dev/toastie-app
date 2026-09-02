'use client';

import { Drawer } from 'antd';
import { useState } from 'react';

import { ProgressRing } from '@/components/ui/progress-ring';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';

import type { TabDef } from './meeting-detail';

interface IconRingProps {
  Icon: TabDef['Icon'];
  /** 0–1 fills the arc; `null` renders the bare track — used by the live
   * tools (Ah Counter, Timer, Grammarian) where a meeting-wide "done" only
   * exists while the meeting is running, not as setup state. */
  ratio: number | null;
}

/** The card's icon with a completion ring around it — the shared
 * `ProgressRing` provides the arc, this adds the section icon inside. */
function IconRing({ Icon, ratio }: IconRingProps) {
  return (
    <ProgressRing ratio={ratio}>
      <Icon size={18} weight="bold" />
    </ProgressRing>
  );
}

interface MeetingFeatureGridProps {
  tabs: TabDef[];
  /** Completion per tab key (0–1), or `null` for sections with no notion of
   * done. What "complete" means is decided per module by the parent — that's
   * where the query data lives. */
  progress: Record<string, number | null>;
}

/** Mobile home for the meeting page — never mounted on desktop, where the
 * tab strip stays. Each meeting feature is a small card: a completion ring
 * around its icon up top, the section name at the bottom left, nothing else.
 * Tapping one slides its section in as a full-width drawer from the right.
 *
 * The URL contract is shared with the desktop tabs (`?tab=<key>`), so a link
 * copied on one form factor opens the same section on the other. The mobile
 * default is the empty key: no parameter, no drawer, just the grid. */
export function MeetingFeatureGrid({ tabs, progress }: MeetingFeatureGridProps) {
  const { activeKey, onChange } = usePersistentTab('tab', '');
  const openTab = tabs.find((tab) => tab.key === activeKey) ?? null;

  /* Every section the drawer has shown stays mounted (hidden) for the life
   * of the page — the desktop tab strip keeps visited panes alive, so live
   * tools like the Timer keep running while you check another section, and
   * the drawer must not be a downgrade. The list doubles as the closing
   * snapshot: while the drawer slides out, its title and body still read the
   * last section instead of blanking mid-animation. */
  const [visited, setVisited] = useState<string[]>([]);
  /* Record the open section during render — React's documented "adjust state
   * while rendering" pattern (an effect would fire after paint and lint
   * forbids setState there). The updater dedupes internally, so StrictMode's
   * double render cannot append a key twice. */
  if (openTab && !visited.includes(openTab.key)) {
    const key = openTab.key;
    setVisited((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }
  const displayKey = openTab?.key ?? visited[visited.length - 1] ?? null;
  const displayTab = tabs.find((tab) => tab.key === displayKey) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="relative flex min-h-28 flex-col items-start justify-end rounded-2xl border border-line bg-canvas p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:bg-fill"
          >
            {/* Ring pinned to the top-right corner; the title owns the left
             * edge, anchored to the bottom so single-word labels and stacked
             * double-word ones ("Prepared / Speakers") share one baseline. */}
            <span className="absolute right-3 top-3">
              <IconRing Icon={Icon} ratio={progress[key] ?? null} />
            </span>
            <span className="w-full text-left text-sm font-semibold leading-tight text-ink">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Full-width on phones — a partial panel at this size is just a page
       * with worse reach. Body padding mirrors `main`'s p-4 so sections sit
       * on the same grid as the rest of the app, plus safe-area clearance
       * for the iOS home bar. `destroyOnHidden` stays off so the visited
       * panes above survive a close. */}
      <Drawer
        open={openTab !== null}
        onClose={() => onChange('')}
        placement="right"
        size="100%"
        destroyOnHidden={false}
        /* Any sheet opened from inside a pane (speaker details, QR share,
         * timer's add-speaker) unconditionally tells its parent drawer to
         * push — rc-drawer only honors `push` on the drawer being pushed.
         * distance: 0 here keeps this full-screen drawer still. */
        push={false}
        title={
          displayTab ? (
            <span className="inline-flex items-center gap-2">
              <displayTab.Icon size={16} weight="bold" />
              {displayTab.label}
            </span>
          ) : null
        }
        extra={displayTab?.headerExtra}
        styles={{
          body: { padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' },
        }}
      >
        {visited.map((key) => {
          const tab = tabs.find((entry) => entry.key === key);
          if (!tab) return null;
          return (
            <div key={key} hidden={key !== displayKey}>
              {tab.content}
            </div>
          );
        })}
      </Drawer>
    </>
  );
}
