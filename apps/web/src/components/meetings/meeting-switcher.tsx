'use client';

import { CalendarBlank, CaretDown, Check } from '@phosphor-icons/react/dist/ssr';
import { Drawer } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useGetMeetingsQuery } from '@/store/api';

/* Matches meeting-card.tsx so a meeting reads the same here as on the hub. */
const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

interface MeetingSwitcherProps {
  /** The meeting currently on screen — rows link to every OTHER meeting. */
  currentId: string;
  /** The button label, e.g. `Meeting #49` — identical to the breadcrumb text
   * this control replaces, so the header reads the same. */
  label: string;
}

/** Mobile-only meeting picker for the app header's top-left title spot on
 * the meeting detail page: the plain "Meeting #49" text becomes a button
 * that opens a bottom sheet of all the club's meetings, so flipping to
 * another meeting mid-prep doesn't need a trip back to the hub. Rendered
 * through the mobile-title slot (PageBreadcrumb → AppShell); desktop keeps
 * the interactive breadcrumb trail instead. */
export function MeetingSwitcher({ currentId, label }: MeetingSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* The list only loads once the sheet opens — the switcher is a button on
   * first paint, and the meeting hub's cached list serves the repeat open. */
  const { data: meetings, isLoading } = useGetMeetingsQuery(undefined, { skip: !open });

  const pick = (id: string) => {
    setOpen(false);
    if (id !== currentId) router.push(`/meetings/${id}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${label}. Switch meeting`}
        aria-haspopup="dialog"
        className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-ink transition-colors hover:bg-fill"
      >
        <span className="truncate">{label}</span>
        <CaretDown size={12} className="shrink-0 text-ink-muted" />
      </button>

      <Drawer
        placement="bottom"
        open={open}
        onClose={() => setOpen(false)}
        size="auto"
        push={false}
        destroyOnHidden
        title={<span className="text-sm font-semibold text-ink">Switch meeting</span>}
        styles={{
          section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          body: {
            padding: 8,
            paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            maxHeight: '70dvh',
            overflowY: 'auto',
          },
        }}
      >
        {isLoading || !meetings ? (
          <div className="flex flex-col gap-2 p-1" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-fill" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-muted">No meetings yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {meetings.map((meeting) => {
              const isCurrent = meeting.id === currentId;
              return (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => pick(meeting.id)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isCurrent ? 'bg-fill-strong' : 'hover:bg-fill'
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink">
                        Meeting #{meeting.meetingNumber}
                        {meeting.theme ? (
                          <span className="font-normal text-ink-soft"> — {meeting.theme}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <CalendarBlank size={12} aria-hidden />
                        <time dateTime={meeting.dateTime}>
                          {DATE_FMT.format(new Date(meeting.dateTime))}
                        </time>
                      </span>
                    </span>
                    {isCurrent ? <Check size={16} className="shrink-0 text-ink" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </>
  );
}
