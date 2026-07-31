'use client';

import { ArrowLeft, GraduationCap, Path } from '@phosphor-icons/react/dist/ssr';
import { Button, Tabs } from 'antd';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import { AppShell } from '@/components/app-shell';
import { HistoryTab } from '@/components/education/history-tab';
import { ProgressTab } from '@/components/education/progress-tab';
import type { Member } from '@/lib/education/members';
import { getInitials, membersStore } from '@/lib/education/members';

/** Same palette as the directory card so the avatar keeps its identity between
 * the two views. Duplicated on purpose — the card file owns its private copy
 * and I'd rather not export it just to share hex codes. */
const AVATAR_PALETTE = [
  { bg: '#FFE4E6', fg: '#881337' },
  { bg: '#FEF3C7', fg: '#78350F' },
  { bg: '#ECFCCB', fg: '#365314' },
  { bg: '#D1FAE5', fg: '#064E3B' },
  { bg: '#CFFAFE', fg: '#164E63' },
  { bg: '#DBEAFE', fg: '#1E3A8A' },
  { bg: '#E0E7FF', fg: '#312E81' },
  { bg: '#EDE9FE', fg: '#4C1D95' },
  { bg: '#FAE8FF', fg: '#701A75' },
  { bg: '#FCE7F3', fg: '#831843' },
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function ProfileHeader({ member }: { member: Member }) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];

  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-canvas">
      <div aria-hidden className="h-24 bg-slate-700" />
      <div className="relative px-6 pb-5">
        <div
          aria-hidden
          className="absolute -top-10 left-6 flex size-20 items-center justify-center rounded-full ring-4 ring-canvas"
          style={{ backgroundColor: swatch.bg, color: swatch.fg }}
        >
          <span className="text-2xl font-semibold tracking-wide">{initials}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 pt-12">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{fullName}</h1>
            <p className="mt-1 text-sm text-ink-soft">{member.role}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill px-3 py-1 text-xs font-medium text-ink-soft">
              <Path size={12} weight="bold" />
              {member.pathway}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill px-3 py-1 text-xs font-medium text-ink-soft">
              <GraduationCap size={12} weight="bold" />
              Level {member.level}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function ProfileContent({ member }: { member: Member }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Link href="/education">
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={14} className="text-ink-muted" />}
          >
            <span className="text-xs text-ink-soft">Back to Members</span>
          </Button>
        </Link>
      </div>

      <ProfileHeader member={member} />

      <Tabs
        defaultActiveKey="progress"
        size="middle"
        items={[
          {
            key: 'progress',
            label: 'Progress',
            children: <ProgressTab member={member} />,
          },
          {
            key: 'history',
            label: 'History',
            children: <HistoryTab member={member} />,
          },
        ]}
      />
    </div>
  );
}

/** Top-level client screen: resolves the member from the URL, hands the name
 * to the shell for the breadcrumb, and renders the profile in the main area. */
export function MemberProfileScreen() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId;
  const members = useSyncExternalStore(
    membersStore.subscribe,
    membersStore.getSnapshot,
    membersStore.getServerSnapshot,
  );

  const member = members.find((entry) => entry.id === memberId);
  if (!member) notFound();

  return (
    <AppShell breadcrumbLabel={`${member.firstName} ${member.lastName}`}>
      <ProfileContent member={member} />
    </AppShell>
  );
}
