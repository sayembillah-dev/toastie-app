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
import { TARGET_SPEAKERS } from '@/components/meetings/at-a-glance';
import { MeetingActions } from '@/components/meetings/meeting-actions';
import { MeetingActionsMobile } from '@/components/meetings/meeting-actions-mobile';
import { MeetingFeatureGrid } from '@/components/meetings/meeting-feature-grid';
import { AhCounterTab } from '@/components/meetings/tabs/ah-counter-tab';
import { AttendanceTab } from '@/components/meetings/tabs/attendance-tab';
import { ChecklistTab } from '@/components/meetings/tabs/checklist-tab';
import { GrammarianTab } from '@/components/meetings/tabs/grammarian-tab';
import { OverviewTab } from '@/components/meetings/tabs/overview-tab';
import { PreparedSpeakersTab } from '@/components/meetings/tabs/prepared-speakers-tab';
import { RolesTab } from '@/components/meetings/tabs/roles-tab';
import { ShareRoleButton } from '@/components/meetings/tabs/share-role-button';
import { TableTopicsTab } from '@/components/meetings/tabs/table-topics-tab';
import { ThemeTab } from '@/components/meetings/tabs/theme-tab';
import { TimerTab } from '@/components/meetings/tabs/timer-tab';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { AccessGate } from '@/components/permissions/access-gate';
import type { Meeting } from '@/lib/meetings/meetings';
import { toDraftSpeakers } from '@/lib/meetings/prepared-speakers';
import { toRoleHolderMap } from '@/lib/meetings/role-assignments';
import { buildRoles } from '@/lib/meetings/roles';
import { useIsMobile } from '@/lib/ui/use-is-mobile';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';
import {
  useGetAttendanceMembersQuery,
  useGetChecklistQuery,
  useGetGuestsQuery,
  useGetMeetingQuery,
  useGetMeetingRolesQuery,
  useGetMembersQuery,
  useGetPreparedSpeakersQuery,
  useGetTableTopicsQuery,
} from '@/store/api';
import { getApiErrorMessage, isNotFoundError } from '@/store/api-error';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  draftHydrated,
  rolesHydrated,
  selectMeetingDraft,
  speakersHydrated,
} from '@/store/meeting-draft-slice';

/* Exported for the mobile card grid, which renders the same defs as cards
 * and drawer titles — one source of truth, two presentations. */
export interface TabDef {
  key: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>;
  content: React.ReactNode;
  /** Rendered on the right of the mobile feature drawer's header (antd
   * Drawer's `extra`). Desktop tabs ignore it — their panes carry their own
   * action rows. */
  headerExtra?: React.ReactNode;
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
      key: 'theme',
      label: 'Theme',
      Icon: Palette,
      content: <ThemeTab meeting={meeting} />,
    },
    {
      key: 'table-topics',
      label: 'Table Topics',
      Icon: Lightbulb,
      content: <TableTopicsTab meetingId={meeting.id} />,
    },
    {
      key: 'timer',
      label: 'Timer',
      Icon: Timer,
      content: <TimerTab meetingId={meeting.id} />,
      headerExtra: (
        <ShareRoleButton
          meetingId={meeting.id}
          kind="timer"
          roleLabel="Timer"
          ariaLabel="Share Timer role"
        />
      ),
    },
    {
      key: 'ah-counter',
      label: 'Ah Counter',
      Icon: SpeakerHigh,
      content: <AhCounterTab meetingId={meeting.id} />,
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
  const isMobile = useIsMobile();
  /* The mobile cards' completion rings each read a different slice — these
   * queries dedupe with the drawer tabs' own through the RTK cache, so they
   * double as prefetching for the moment a card is tapped. */
  const draft = useAppSelector((state) => selectMeetingDraft(state, meeting.id));
  const { data: checklist } = useGetChecklistQuery(meeting.id);
  const { data: topics } = useGetTableTopicsQuery(meeting.id);
  const { data: attendanceMembers } = useGetAttendanceMembersQuery(meeting.id);
  const { data: roster } = useGetMembersQuery();

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

  /* One completion ratio per card — what "done" means is per module by
   * design. Theme/roles/speakers mirror the At a Glance readiness checks
   * (optional roles excluded there, so excluded here too); checklist, topics
   * and attendance track their own rows; the live tools (Ah Counter, Timer,
   * Grammarian) stay `null` — a bare track ring — because meeting-wide
   * "done" doesn't exist for work that only happens during the meeting.
   * `null` while a query is in flight reads the same: no verdict yet. */
  const cardProgress: Record<string, number | null> = {};

  const themeParts = [draft.theme.trim() || meeting.theme, draft.word.word, draft.word.meaning];
  const themeRatio = themeParts.filter((part) => part.trim()).length / themeParts.length;

  const requiredRoles = buildRoles(meeting).filter((role) => !role.optional);
  const rolesRatio =
    roleRows === undefined || requiredRoles.length === 0
      ? null
      : requiredRoles.filter((role) => {
          const row = roleRows.find((entry) => entry.roleKey === role.key);
          return Boolean(row?.membershipId || row?.guestId);
        }).length / requiredRoles.length;

  const speakersRatio =
    speakerRows === undefined
      ? null
      : Math.min(speakerRows.length, TARGET_SPEAKERS) / TARGET_SPEAKERS;

  /* Overview reads as the mean of the setup ratios, the same way the At a
   * Glance panel averages its checks. */
  const setupRatios = [themeRatio, rolesRatio, speakersRatio].filter(
    (ratio): ratio is number => ratio !== null,
  );
  cardProgress.overview =
    setupRatios.length > 0
      ? setupRatios.reduce((sum, ratio) => sum + ratio, 0) / setupRatios.length
      : null;
  cardProgress.theme = themeRatio;
  cardProgress.roles = rolesRatio;
  cardProgress['prepared-speakers'] = speakersRatio;
  cardProgress.checklist =
    checklist === undefined || checklist.length === 0
      ? null
      : checklist.filter((item) => item.done).length / checklist.length;
  cardProgress['table-topics'] =
    topics === undefined || topics.length === 0
      ? null
      : topics.filter((topic) => topic.asked).length / topics.length;
  cardProgress.attendance =
    attendanceMembers === undefined || roster === undefined || roster.length === 0
      ? null
      : attendanceMembers.filter((row) => row.present).length / roster.length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* The commit bar has its own mobile presentation — while the
       * breakpoint is unknown, hold its height so the grid below doesn't
       * jump when it resolves. */}
      {isMobile === null ? (
        <div
          className="mb-4 h-15 animate-pulse rounded-2xl border border-line bg-fill"
          aria-hidden
        />
      ) : isMobile ? (
        <MeetingActionsMobile meeting={meeting} />
      ) : (
        <MeetingActions meeting={meeting} />
      )}

      {/* `null` means the breakpoint has not reported yet (first client
       * frame) — hold a placeholder rather than guess a form factor and
       * flash the wrong one. */}
      {isMobile === null ? (
        <div className="h-96 animate-pulse rounded-2xl border border-line bg-fill" aria-hidden />
      ) : isMobile ? (
        <MeetingFeatureGrid tabs={tabs} progress={cardProgress} />
      ) : (
        <DesktopMeetingTabs tabs={tabs} />
      )}
    </div>
  );
}

/** The desktop presentation — the tab strip. Mobile mounts the card grid
 * instead; the two never coexist, so each owns its `usePersistentTab` call
 * with its own default (desktop opens on Overview, mobile on the grid with
 * no drawer), and a `?tab=<key>` link means the same section to both. */
function DesktopMeetingTabs({ tabs }: { tabs: TabDef[] }) {
  const { activeKey, onChange } = usePersistentTab('tab', 'overview');

  return (
    /* antd's arrow-scroll controls only cover mouse/keyboard — the nav
     * strip's own touch handler never calls preventDefault (see
     * @rc-component/tabs's useTouchMove), so a swipe here falls through to
     * whatever ancestor is horizontally scrollable. That ancestor is meant
     * to be nothing: `main` in app-shell.tsx sets `overflow-x-hidden`
     * precisely so a swipe on this strip has nowhere to leak into. */
    <Tabs
      activeKey={activeKey}
      onChange={onChange}
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
