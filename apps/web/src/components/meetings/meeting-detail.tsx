'use client';

import {
  ClipboardText,
  Info,
  Lightbulb,
  MicrophoneStage,
  Palette,
  SpeakerHigh,
  TextAa,
  Timer,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import { Tabs } from 'antd';
import { notFound, useParams } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { AhCounterTab } from '@/components/meetings/tabs/ah-counter-tab';
import { AttendanceTab } from '@/components/meetings/tabs/attendance-tab';
import { GrammarianTab } from '@/components/meetings/tabs/grammarian-tab';
import { PreparedSpeakersTab } from '@/components/meetings/tabs/prepared-speakers-tab';
import { RolesTab } from '@/components/meetings/tabs/roles-tab';
import { TableTopicsTab } from '@/components/meetings/tabs/table-topics-tab';
import { ThemeTab } from '@/components/meetings/tabs/theme-tab';
import { TimerTab } from '@/components/meetings/tabs/timer-tab';
import type { Meeting } from '@/lib/meetings/meetings';
import { getMeetingById } from '@/lib/meetings/meetings';

/** Placeholder body for tabs that haven't been built out yet. Swapped for the
 * real section as each one lands. */
function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">{body}</p>
    </div>
  );
}

interface TabDef {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>;
  content: React.ReactNode;
}

/* Tabs are built per meeting so sections that depend on meeting data (e.g.
 * Roles switching between Day and Evening Toastmaster) can read it directly.
 * Ordered exactly as the user listed the tabs. Icons are Phosphor per the
 * project convention. */
function buildTabs(meeting: Meeting): TabDef[] {
  return [
    {
      key: 'overview',
      label: 'Overview',
      Icon: Info,
      content: (
        <TabPlaceholder
          title="Overview"
          body="High-level snapshot of the meeting will live here."
        />
      ),
    },
    {
      key: 'theme',
      label: 'Theme',
      Icon: Palette,
      content: <ThemeTab />,
    },
    {
      key: 'roles',
      label: 'Roles',
      Icon: UsersThree,
      content: <RolesTab meeting={meeting} />,
    },
    {
      key: 'prepared-speakers',
      label: 'Prepared Speakers',
      Icon: MicrophoneStage,
      content: <PreparedSpeakersTab />,
    },
    {
      key: 'table-topics',
      label: 'Table Topics',
      Icon: Lightbulb,
      content: <TableTopicsTab />,
    },
    {
      key: 'ah-counter',
      label: 'Ah Counter',
      Icon: SpeakerHigh,
      content: <AhCounterTab />,
    },
    {
      key: 'timer',
      label: 'Timer',
      Icon: Timer,
      content: <TimerTab />,
    },
    {
      key: 'grammarian',
      label: 'Grammarian',
      Icon: TextAa,
      content: <GrammarianTab />,
    },
    {
      key: 'attendance',
      label: 'Attendance',
      Icon: ClipboardText,
      content: <AttendanceTab />,
    },
  ];
}

function DetailContent({ meeting }: { meeting: Meeting }) {
  const tabs = buildTabs(meeting);

  return (
    <div className="mx-auto max-w-6xl">
      {/* antd Tabs already scrolls horizontally with arrow controls when the
       * label row overflows — no extra wiring needed for the mobile case. */}
      <Tabs
        defaultActiveKey="overview"
        size="middle"
        items={tabs.map(({ key, label, Icon, content }) => ({
          key,
          label: (
            <span className="inline-flex items-center gap-1.5">
              <Icon size={14} weight="bold" />
              {label}
            </span>
          ),
          children: content,
        }))}
      />
    </div>
  );
}

/** Top-level client screen for the meeting detail route. Resolves the meeting
 * from the URL, hands off to `notFound()` for unknown ids, and renders the
 * shell with a breadcrumb crumb that reads as "#41" rather than the raw id. */
export function MeetingDetailScreen() {
  const params = useParams<{ meetingId: string }>();
  const meeting = params?.meetingId ? getMeetingById(params.meetingId) : null;

  if (!meeting) notFound();

  return (
    <AppShell breadcrumbLabel={`Meeting #${meeting.meetingNumber}`}>
      <DetailContent meeting={meeting} />
    </AppShell>
  );
}
