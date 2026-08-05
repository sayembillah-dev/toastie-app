'use client';

import {
  Buildings,
  CaretDown,
  Check,
  Compass,
  Crown,
  Globe,
  MapPin,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr';
import { Dropdown } from 'antd';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { activeUnitChanged, selectActiveUnit, type UnitKey } from '@/store/ui-slice';

type IconComponent = React.ComponentType<{
  size?: number;
  weight?: 'regular' | 'fill' | 'bold' | 'duotone';
  className?: string;
}>;

interface Unit {
  key: UnitKey;
  name: string;
  /** One-line hint under the name — sets expectations for what the scope shows. */
  description: string;
  Icon: IconComponent;
}

/** Ordered widest-out: the tier the officer is closest to sits first, then each
 * step up the org tree. `super-admin` is intentionally last so it never sits
 * next to `club` and dilutes the visual hierarchy. */
const UNITS: Unit[] = [
  { key: 'club', name: 'Club', description: 'Your home club', Icon: Buildings },
  { key: 'club-admin', name: 'Club Admin', description: 'Officer view', Icon: ShieldCheck },
  { key: 'area', name: 'Area', description: 'Area director scope', Icon: MapPin },
  { key: 'division', name: 'Division', description: 'Division scope', Icon: Compass },
  { key: 'district', name: 'District', description: 'District scope', Icon: Globe },
  { key: 'super-admin', name: 'Super Admin', description: 'Full access', Icon: Crown },
];

export function UnitSwitcher() {
  const activeUnit = useAppSelector(selectActiveUnit);
  const dispatch = useAppDispatch();
  const current = UNITS.find((unit) => unit.key === activeUnit) ?? UNITS[0];
  const CurrentIcon = current.Icon;

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => (
        <div className="w-72 rounded-xl border border-line bg-canvas p-1.5 shadow-lg">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Switch scope
          </div>
          <div className="flex flex-col gap-0.5">
            {UNITS.map((unit) => {
              const isActive = unit.key === current.key;
              const ItemIcon = unit.Icon;
              return (
                <button
                  key={unit.key}
                  type="button"
                  onClick={() => dispatch(activeUnitChanged(unit.key))}
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
                    <span className="truncate text-sm font-medium text-ink">{unit.name}</span>
                    <span className="truncate text-xs text-ink-muted">{unit.description}</span>
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
        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2 pr-1.5 text-sm text-ink transition-colors hover:bg-fill"
      >
        <CurrentIcon size={14} className="text-ink-soft" />
        <span className="truncate font-medium">{current.name}</span>
        <CaretDown size={12} className="ml-0.5 text-ink-muted" />
      </button>
    </Dropdown>
  );
}
