'use client';

import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import type { CalendarProps } from 'antd';
import { Button, Calendar, Drawer } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import type { Idea, IdeaStatus } from '@/components/library/planner-day-panel';
import { PlannerDayPanel } from '@/components/library/planner-day-panel';

/** Tracks antd's `md` breakpoint. Above it we render the full month grid;
 * below, antd's compact card variant is the mobile-friendly form. Initial
 * value matches SSR (`false`) so hydration never mismatches — the client
 * flips once matchMedia reports on mount. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

/** Every day owns its own bucket of ideas keyed by YYYY-MM-DD. Client state
 * only for now — persistence lands with the backend pass. */
type IdeasByDay = Record<string, Idea[]>;

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Month-view calendar for the Library planner. Clicking a date opens a
 * right-side drawer with that day's ideas. */
export function PlannerTab() {
  const isDesktop = useIsDesktop();
  const [selected, setSelected] = useState<Dayjs | null>(null);
  const [open, setOpen] = useState(false);
  const [ideasByDay, setIdeasByDay] = useState<IdeasByDay>({});

  /* onSelect fires for both date picks AND header navigation (month/year
   * dropdowns in compact mode). Only 'date' should open the drawer. */
  const handleSelect: NonNullable<CalendarProps<Dayjs>['onSelect']> = (date, info) => {
    if (info?.source && info.source !== 'date') return;
    setSelected(date);
    setOpen(true);
  };

  const selectedKey = selected ? selected.format('YYYY-MM-DD') : '';
  const ideas = useMemo(() => ideasByDay[selectedKey] ?? [], [ideasByDay, selectedKey]);

  const addIdea = (draft: Omit<Idea, 'id' | 'status'>) => {
    if (!selectedKey) return;
    setIdeasByDay((prev) => ({
      ...prev,
      [selectedKey]: [...(prev[selectedKey] ?? []), { ...draft, id: makeId(), status: 'created' }],
    }));
  };

  const removeIdea = (id: string) => {
    if (!selectedKey) return;
    setIdeasByDay((prev) => ({
      ...prev,
      [selectedKey]: (prev[selectedKey] ?? []).filter((idea) => idea.id !== id),
    }));
  };

  const updateIdeaStatus = (id: string, status: IdeaStatus) => {
    if (!selectedKey) return;
    setIdeasByDay((prev) => ({
      ...prev,
      [selectedKey]: (prev[selectedKey] ?? []).map((idea) =>
        idea.id === id ? { ...idea, status } : idea,
      ),
    }));
  };

  /* Cell decoration: a count chip on desktop, a dot on mobile. When every
   * idea on the day is published, the marker flips green so the calendar
   * doubles as an at-a-glance progress view. */
  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return null;
    const dayIdeas = ideasByDay[current.format('YYYY-MM-DD')] ?? [];
    if (dayIdeas.length === 0) return null;
    const allPublished = dayIdeas.every((idea) => idea.status === 'published');

    if (isDesktop) {
      return (
        <div className="flex justify-start">
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${
              allPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-fill text-ink-soft'
            }`}
          >
            {dayIdeas.length} {dayIdeas.length === 1 ? 'idea' : 'ideas'}
          </span>
        </div>
      );
    }

    return (
      <div className="mt-0.5 flex justify-center">
        <span
          role="img"
          aria-label={allPublished ? 'All ideas published' : `${dayIdeas.length} ideas`}
          className={`h-1.5 w-1.5 rounded-full ${allPublished ? 'bg-emerald-500' : 'bg-ink-soft'}`}
        />
      </div>
    );
  };

  return (
    <>
      <Calendar
        onSelect={handleSelect}
        fullscreen={isDesktop}
        cellRender={cellRender}
        headerRender={({ value, onChange }) => (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">{value.format('MMMM YYYY')}</h2>
            <div className="flex items-center gap-1">
              <Button
                size="small"
                aria-label="Previous month"
                icon={<CaretLeft size={14} />}
                onClick={() => onChange(value.subtract(1, 'month'))}
              />
              <Button size="small" onClick={() => onChange(dayjs())}>
                Today
              </Button>
              <Button
                size="small"
                aria-label="Next month"
                icon={<CaretRight size={14} />}
                onClick={() => onChange(value.add(1, 'month'))}
              />
            </div>
          </div>
        )}
      />

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="right"
        /* antd v6 deprecated the numeric `width` prop; styling the wrapper is
         * the sanctioned escape hatch that still lets us go full-width on
         * phones and take a comfortable panel width on desktop. */
        styles={{ wrapper: { width: isDesktop ? 420 : '100%' } }}
        title={selected ? selected.format('dddd, MMMM D, YYYY') : 'Details'}
      >
        {/* Keying by day resets the panel's local form state when the user
         * jumps to another date without closing the drawer. */}
        <PlannerDayPanel
          key={selectedKey}
          ideas={ideas}
          onAdd={addIdea}
          onRemove={removeIdea}
          onStatusChange={updateIdeaStatus}
        />
      </Drawer>
    </>
  );
}
