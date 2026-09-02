'use client';

import {
  Buildings,
  CaretDown,
  Check,
  Compass,
  Crown,
  Globe,
  MapPin,
} from '@phosphor-icons/react/dist/ssr';
import type { ActiveContextKey } from '@toastly/access';
import { Dropdown } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { writeStoredContext } from '@/lib/auth/token-storage';
import { toastlyApi } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  contextChanged,
  defaultRouteForContext,
  selectActiveContextKey,
  selectSessionMemberships,
  selectSessionOrgAssignments,
  selectSessionUser,
} from '@/store/session-slice';

type IconComponent = React.ComponentType<{
  size?: number;
  weight?: 'regular' | 'fill' | 'bold' | 'duotone';
  className?: string;
}>;

interface UnitEntry {
  contextKey: ActiveContextKey;
  name: string;
  description: string;
  Icon: IconComponent;
}

const ORG_ICON: Record<'area' | 'division' | 'district', IconComponent> = {
  area: MapPin,
  division: Compass,
  district: Globe,
};

const ORG_NAME: Record<'area' | 'division' | 'district', string> = {
  area: 'Area',
  division: 'Division',
  district: 'District',
};

interface UnitSwitcherProps {
  /** Full-width row treatment for the mobile nav drawer — taller target,
   * left-aligned popup sized to stay inside the drawer's 288px. */
  block?: boolean;
  /** Fired after a switch is committed — the mobile drawer uses it to
   * close itself, since the switch routes to the new scope's dashboard. */
  onSelected?: () => void;
}

export function UnitSwitcher({ block = false, onSelected }: UnitSwitcherProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  /* Open state is controlled so a committed switch can force the popup shut:
   * in the mobile drawer the trigger outlives the close (the drawer's body
   * stays mounted), so an uncontrolled popup would linger over the page the
   * switch just routed to. */
  const [open, setOpen] = useState(false);
  const contextKey = useAppSelector(selectActiveContextKey);
  const user = useAppSelector(selectSessionUser);
  const memberships = useAppSelector(selectSessionMemberships);
  const orgAssignments = useAppSelector(selectSessionOrgAssignments);

  /* Entries are built from the session — one per membership, one per org
   * assignment, and a Super Admin entry for the corresponding user flag. If
   * the session hasn't populated yet, fall back to a single Club entry so the
   * header still renders something recognisable on first paint. */
  const entries: UnitEntry[] = [
    ...memberships.map<UnitEntry>((m) => ({
      contextKey: `club:${m.clubId}` as ActiveContextKey,
      name: m.clubName,
      description: 'Club context',
      Icon: Buildings,
    })),
    ...orgAssignments.map<UnitEntry>((a) => ({
      contextKey: `${a.unitType}:${a.unitId}` as ActiveContextKey,
      name: a.unitName || ORG_NAME[a.unitType],
      description: `${ORG_NAME[a.unitType]} director scope`,
      Icon: ORG_ICON[a.unitType],
    })),
    ...(user?.isSuperAdmin
      ? [
          {
            contextKey: 'global' as ActiveContextKey,
            name: 'Super Admin',
            description: 'Full access',
            Icon: Crown,
          },
        ]
      : []),
  ];

  const fallback: UnitEntry = {
    contextKey: 'club:local' as ActiveContextKey,
    name: 'Club',
    description: 'Your home club',
    Icon: Buildings,
  };

  const current = entries.find((e) => e.contextKey === contextKey) ?? entries[0] ?? fallback;
  const CurrentIcon = current.Icon;

  /* Context switch: cache reset is the load-bearing part. Every cache entry
   * is tenant-scoped but RTKQ keys aren't, so anything from the old context
   * would masquerade as the new one on the next render. `activeUnit` is
   * derived from `contextKey` in `ui-slice`, so this single dispatch drives
   * the sidebar shape too. */
  const selectEntry = (entry: UnitEntry) => {
    setOpen(false);
    dispatch(contextChanged(entry.contextKey));
    writeStoredContext(entry.contextKey);
    dispatch(toastlyApi.util.resetApiState());
    router.push(defaultRouteForContext(entry.contextKey));
    onSelected?.();
  };

  return (
    <Dropdown
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
      placement={block ? 'bottomLeft' : 'bottomRight'}
      popupRender={() => (
        <div
          className={`${block ? 'w-[16.5rem]' : 'w-72'} rounded-xl border border-line bg-canvas p-1.5 shadow-lg`}
        >
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Switch scope
          </div>
          <div className="flex flex-col gap-0.5">
            {(entries.length > 0 ? entries : [fallback]).map((entry) => {
              const isActive = entry.contextKey === current.contextKey;
              const ItemIcon = entry.Icon;
              return (
                <button
                  key={entry.contextKey}
                  type="button"
                  onClick={() => selectEntry(entry)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${
                    isActive ? 'bg-fill-strong' : 'hover:bg-fill'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? 'bg-ink text-canvas' : 'bg-fill text-ink-soft'
                    }`}
                  >
                    <ItemIcon size={16} weight={isActive ? 'fill' : 'regular'} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{entry.name}</span>
                    <span className="truncate text-xs text-ink-muted">{entry.description}</span>
                  </span>
                  {isActive ? <Check size={16} className="shrink-0 text-ink" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    >
      <button
        type="button"
        aria-label={`Unit: ${current.name}. Click to switch scope.`}
        className={`flex items-center gap-1.5 rounded-lg border border-line text-sm text-ink transition-colors hover:bg-fill ${
          block ? 'h-10 w-full px-3 pr-2' : 'h-8 px-2 pr-1.5'
        }`}
      >
        <CurrentIcon size={14} className="shrink-0 text-ink-soft" />
        <span className={`truncate font-medium ${block ? 'flex-1 text-left' : ''}`}>
          {current.name}
        </span>
        <CaretDown size={12} className={`${block ? 'ml-auto' : 'ml-0.5'} text-ink-muted`} />
      </button>
    </Dropdown>
  );
}
