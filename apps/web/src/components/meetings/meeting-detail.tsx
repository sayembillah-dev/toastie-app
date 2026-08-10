'use client';

import {
  CheckSquare,
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
import { useEffect } from 'react';
import { MeetingActions } from '@/components/meetings/meeting-actions';
import { AhCounterTab } from '@/components/meetings/tabs/ah-counter-tab';
import { AttendanceTab } from '@/components/meetings/tabs/attendance-tab';
import { ChecklistTab } from '@/components/meetings/tabs/checklist-tab';
import { GrammarianTab } from '@/components/meetings/tabs/grammarian-tab';
import { OverviewTab } from '@/components/meetings/tabs/overview-tab';
import { PreparedSpeakersTab } from '@/components/meetings/tabs/prepared-speakers-tab';
import { RolesTab } from '@/components/meetings/tabs/roles-tab';
import { TableTopicsTab } from '@/components/meetings/tabs/table-topics-tab';
import { ThemeTab } from '@/components/meetings/tabs/theme-tab';
import { TimerTab } from '@/components/meetings/tabs/timer-tab';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { AccessGate } from '@/components/permissions/access-gate';
import type { Meeting } from '@/lib/meetings/meetings';
import { toDraftSpeakers } from '@/lib/meetings/prepared-speakers';
import { toRoleHolderMap } from '@/lib/meetings/role-assignments';
import {
  useGetGuestsQuery,
  useGetMeetingQuery,
  useGetMeetingRolesQuery,
  useGetPreparedSpeakersQuery,
} from '@/store/api';
import { getApiErrorMessage, isNotFoundError } from '@/store/api-error';
import { useAppDispatch } from '@/store/hooks';
import { draftHydrated, rolesHydrated, speakersHydrated } from '@/store/meeting-draft-slice';

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
      content: <OverviewTab meeting={meeting} />,
    },
    {
      key: 'checklist',
      label: 'Checklist',
      Icon: CheckSquare,
      content: <ChecklistTab meetingId={meeting.id} />,
    },
    {
      key: 'theme',
      label: 'Theme',
      Icon: Palette,
      content: <ThemeTab meeting={meeting} />,
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
      content: <PreparedSpeakersTab meeting={meeting} />,
    },
    {
      key: 'table-topics',
      label: 'Table Topics',
      Icon: Lightbulb,
      content: <TableTopicsTab meetingId={meeting.id} />,
    },
    {
      key: 'ah-counter',
      label: 'Ah Counter',
      Icon: SpeakerHigh,
      content: <AhCounterTab meetingId={meeting.id} />,
    },
    {
      key: 'timer',
      label: 'Timer',
      Icon: Timer,
      content: <TimerTab meetingId={meeting.id} />,
    },
    {
      key: 'grammarian',
      label: 'Grammarian',
      Icon: TextAa,
      content: <GrammarianTab meetingId={meeting.id} />,
    },
    {
      key: 'attendance',
      label: 'Attendance',
      Icon: ClipboardText,
      content: <AttendanceTab meetingId={meeting.id} />,
    },
  ];
}

function DetailContent({ meeting }: { meeting: Meeting }) {
  const tabs = buildTabs(meeting);
  const dispatch = useAppDispatch();
  const { data: roleRows } = useGetMeetingRolesQuery(meeting.id);
  const { data: speakerRows } = useGetPreparedSpeakersQuery(meeting.id);
  const { data: guests } = useGetGuestsQuery();

  /* Seed the working draft from the saved record once the meeting lands.
   * Done here rather than inside the Theme tab because Overview's readiness
   * panel reads the same draft, and it is the tab that opens first — the
   * word would otherwise read as "not set" until you visited Theme. */
  useEffect(() => {
    dispatch(draftHydrated({ meetingId: meeting.id, theme: meeting.theme, word: meeting.word }));
  }, [dispatch, meeting.id, meeting.theme, meeting.word]);

  /* Mirror the persisted role assignments into the draft so Overview and the
   * Agenda sheet — which only read the draft, not the API — stay correct
   * without requiring a visit to the Roles tab. Every role pick already
   * round-trips through the API, so (unlike theme/word) this can just
   * overwrite on every fetch rather than guard against clobbering an
   * unsaved edit. */
  useEffect(() => {
    if (!roleRows) return;
    dispatch(
      rolesHydrated({ meetingId: meeting.id, roles: toRoleHolderMap(roleRows, guests ?? []) }),
    );
  }, [dispatch, meeting.id, roleRows, guests]);

  /* Same read-through pattern as roles, for the Prepared Speakers tab's own
   * API-backed rows — Overview and the Agenda sheet only ever read the
   * draft, never the query directly. */
  useEffect(() => {
    if (!speakerRows) return;
    dispatch(
      speakersHydrated({
        meetingId: meeting.id,
        speakers: toDraftSpeakers(speakerRows, guests ?? []),
      }),
    );
  }, [dispatch, meeting.id, speakerRows, guests]);

  return (
    <div className="mx-auto max-w-6xl">
      <MeetingActions meeting={meeting} />

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

/* Holds the tab row and one panel's worth of height so the fetch doesn't
 * collapse the page and then push it back open. */
function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl" aria-hidden>
      <div className="mb-4 h-9 animate-pulse rounded-lg bg-fill" />
      <div className="h-96 animate-pulse rounded-2xl border border-line bg-fill" />
    </div>
  );
}

/** Top-level client screen for the meeting detail route. Resolves the meeting
 * through the API — meetings created from the hub only exist there — hands off
 * to `notFound()` for unknown ids, and renders the shell with a breadcrumb that
 * reads as "#41" rather than the raw id. */
export function MeetingDetailScreen() {
  const params = useParams<{ meetingId: string }>();
  const meetingId = params?.meetingId ?? '';
  const {
    data: meeting,
    error,
    isLoading,
  } = useGetMeetingQuery(meetingId, { skip: meetingId === '' });

  if (meetingId === '' || isNotFoundError(error)) notFound();

  if (isLoading || (!meeting && !error)) {
    return (
      <>
        <PageBreadcrumb label="Meeting" />
        <DetailSkeleton />
      </>
    );
  }

  if (!meeting) {
    return (
      <>
        <PageBreadcrumb label="Meeting" />
        <div
          role="alert"
          className="mx-auto max-w-6xl rounded-xl border border-dashed border-line-strong px-6 py-16 text-center"
        >
          <p className="text-sm font-medium text-ink">Could not load this meeting</p>
          <p className="mt-1 text-xs text-ink-muted">
            {getApiErrorMessage(error, 'Please try again in a moment.')}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBreadcrumb label={`Meeting #${meeting.meetingNumber}`} />
      <AccessGate resource="meeting">
        <DetailContent meeting={meeting} />
      </AccessGate>
    </>
  );
}
