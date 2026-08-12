'use client';

import { CaretLeft, CaretRight, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import type { CalendarProps } from 'antd';
import { App, Button, Calendar, Drawer } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { PlannerDayPanel } from '@/components/library/planner-day-panel';
import type { CreatePlannerIdeaInput, IdeaStatus } from '@/lib/library/planner';
import { groupIdeasByDay } from '@/lib/library/planner';
import {
  useCreatePlannerIdeaMutation,
  useDeletePlannerIdeaMutation,
  useListPlannerIdeasQuery,
  useUpdatePlannerIdeaMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

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

/** Days of slack on either side of the month when fetching. The month grid
 * renders trailing days of the previous month and leading days of the next
 * one, and how many depends on the locale's first-day-of-week — a flat week
 * of padding covers every arrangement without having to reason about it. */
const GRID_PADDING_DAYS = 7;

const DAY_FORMAT = 'YYYY-MM-DD';

/** Month-view calendar for the Library planner. Clicking a date opens a
 * right-side drawer with that day's ideas, which are persisted per club
 * through `/planner/ideas`. */
export function PlannerTab() {
  const isDesktop = useIsDesktop();
  const { message } = App.useApp();

  /* The calendar is controlled so the visible month is available as query
   * state — the fetch window is derived from it. */
  const [panelDate, setPanelDate] = useState(() => dayjs());
  const [selected, setSelected] = useState<Dayjs | null>(null);
  const [open, setOpen] = useState(false);

  const range = useMemo(
    () => ({
      from: panelDate.startOf('month').subtract(GRID_PADDING_DAYS, 'day').format(DAY_FORMAT),
      to: panelDate.endOf('month').add(GRID_PADDING_DAYS, 'day').format(DAY_FORMAT),
    }),
    [panelDate],
  );

  const { data, isLoading, isError, error, refetch } = useListPlannerIdeasQuery(range);
  const [createIdea] = useCreatePlannerIdeaMutation();
  const [updateIdea] = useUpdatePlannerIdeaMutation();
  const [deleteIdea] = useDeletePlannerIdeaMutation();

  const ideasByDay = useMemo(() => groupIdeasByDay(data ?? []), [data]);

  /* onSelect fires for both date picks AND header navigation (month/year
   * dropdowns in compact mode). Only 'date' should open the drawer. */
  const handleSelect: NonNullable<CalendarProps<Dayjs>['onSelect']> = (date, info) => {
    setPanelDate(date);
    if (info?.source && info.source !== 'date') return;
    setSelected(date);
    setOpen(true);
  };

  const selectedKey = selected ? selected.format(DAY_FORMAT) : '';
  const ideas = useMemo(() => ideasByDay[selectedKey] ?? [], [ideasByDay, selectedKey]);

  const addIdea = async (draft: Omit<CreatePlannerIdeaInput, 'day'>) => {
    if (!selectedKey) return false;
    try {
      await createIdea({ ...draft, day: selectedKey }).unwrap();
      return true;
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not save the idea'));
      return false;
    }
  };

  const removeIdea = async (id: string) => {
    try {
      await deleteIdea(id).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not delete the idea'));
    }
  };

  const updateIdeaStatus = async (id: string, status: IdeaStatus) => {
    try {
      await updateIdea({ ideaId: id, status }).unwrap();
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Could not update the status'));
    }
  };

  /* Cell decoration: a count chip on desktop, a dot on mobile. When every
   * idea on the day is published, the marker flips green so the calendar
   * doubles as an at-a-glance progress view. */
  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type !== 'date') return null;
    const dayIdeas = ideasByDay[current.format(DAY_FORMAT)] ?? [];
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
      {isError ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-fill/40 px-3 py-2 text-sm text-ink-soft">
          <WarningCircle size={16} className="text-amber-500" />
          {getApiErrorMessage(error, 'Could not load the planner')}
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : null}

      <Calendar
        value={panelDate}
        onChange={setPanelDate}
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
          loading={isLoading}
          onAdd={addIdea}
          onRemove={removeIdea}
          onStatusChange={updateIdeaStatus}
        />
      </Drawer>
    </>
  );
}
