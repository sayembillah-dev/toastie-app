'use client';

import {
  ArrowLeft,
  GraduationCap,
  Path,
  PencilSimple,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr';
import { skipToken } from '@reduxjs/toolkit/query';
import { Button, Tabs } from 'antd';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { HistoryTab } from '@/components/education/history-tab';
import { ProgressTab } from '@/components/education/progress-tab';
import { StartPathwayModal } from '@/components/education/start-pathway-modal';
import { PageBreadcrumb } from '@/components/page-breadcrumb';
import { AccessGate } from '@/components/permissions/access-gate';
import { PersonAvatar } from '@/components/ui/person-avatar';
import type { Member } from '@/lib/education/members';
import { formatRoles, getInitials } from '@/lib/education/members';
import { useCan } from '@/lib/permissions/use-can';
import { usePersistentTab } from '@/lib/ui/use-persistent-tab';
import { useGetMemberQuery } from '@/store/api';
import { getApiErrorMessage, isNotFoundError } from '@/store/api-error';

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

function ProfileHeader({
  member,
  canManagePathway,
  onStartPathway,
}: {
  member: Member;
  /** Viewer may start/edit this member's pathway — club education managers,
   * or the member themselves (own-scoped grant). Hides the CTA otherwise. */
  canManagePathway: boolean;
  onStartPathway: () => void;
}) {
  const fullName = `${member.firstName} ${member.lastName}`;
  const initials = getInitials(member);
  const swatch = AVATAR_PALETTE[hashString(member.id) % AVATAR_PALETTE.length];
  const hasPathway = Boolean(member.pathway && member.level);

  return (
    <header className="relative overflow-hidden rounded-2xl border border-line bg-canvas">
      <div aria-hidden className="h-24 bg-slate-700" />
      <div className="relative px-6 pb-5">
        <PersonAvatar
          src={member.avatarUrl}
          initials={initials}
          swatch={swatch}
          sizeClass="size-20"
          textClass="text-2xl tracking-wide"
          className="absolute -top-10 left-6 ring-4 ring-canvas"
        />
        <div className="flex flex-wrap items-end justify-between gap-4 pt-12">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">{fullName}</h1>
            <p className="mt-1 text-sm text-ink-soft">{formatRoles(member)}</p>
          </div>
          {hasPathway ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill px-3 py-1 text-xs font-medium text-ink-soft">
                <Path size={12} weight="bold" />
                {member.pathway}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-fill px-3 py-1 text-xs font-medium text-ink-soft">
                <GraduationCap size={12} weight="bold" />
                Level {member.level}
              </span>
              {canManagePathway ? (
                <Button
                  size="middle"
                  onClick={onStartPathway}
                  icon={<PencilSimple size={14} weight="bold" />}
                  className="w-full sm:w-auto"
                >
                  Edit
                </Button>
              ) : null}
            </div>
          ) : canManagePathway ? (
            <Button
              type="primary"
              size="middle"
              onClick={onStartPathway}
              icon={<Path size={14} weight="bold" />}
              className="w-full sm:w-auto"
            >
              Start Pathway
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProfileContent({ member }: { member: Member }) {
  const [modalOpen, setModalOpen] = useState(false);
  const { activeKey, onChange } = usePersistentTab('tab', 'progress');
  const { can } = useCan();
  /* Club education managers pass on their club-scope grant; everyone else
   * only when the profile is their own (own-scoped grant, checked with the
   * same ownerMembershipId convention the API service uses). */
  const canManagePathway = can('update', 'education', {
    clubId: member.clubId,
    ownerMembershipId: member.id,
  });

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

      <ProfileHeader
        member={member}
        canManagePathway={canManagePathway}
        onStartPathway={() => setModalOpen(true)}
      />

      <Tabs
        activeKey={activeKey}
        onChange={onChange}
        size="middle"
        items={[
          {
            key: 'progress',
            label: 'Progress',
            children: (
              <ProgressTab
                member={member}
                canManagePathway={canManagePathway}
                onStartPathway={() => setModalOpen(true)}
              />
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: <HistoryTab member={member} />,
          },
        ]}
      />

      <StartPathwayModal open={modalOpen} member={member} onClose={() => setModalOpen(false)} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-hidden>
      <div className="h-7 w-32 animate-pulse rounded bg-fill-strong" />
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas">
        <div className="h-24 animate-pulse bg-fill-strong" />
        <div className="flex flex-col gap-3 px-6 pb-5 pt-14">
          <div className="h-6 w-56 animate-pulse rounded bg-fill-strong" />
          <div className="h-4 w-24 animate-pulse rounded bg-fill-strong" />
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-line bg-fill" />
    </div>
  );
}

/** Top-level client screen: resolves the member from the URL, hands the name
 * to the shell for the breadcrumb, and renders the profile in the main area.
 * The record is fetched rather than read synchronously, so the first paint is a
 * skeleton — exactly what it will be once the API is remote. */
export function MemberProfileScreen() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId;
  const { data: member, isError, error } = useGetMemberQuery(memberId ?? skipToken);

  if (isError) {
    // A missing id is a real 404 for the route; anything else is a fetch failure
    // the member can retry, so it stays inside the shell.
    if (isNotFoundError(error)) notFound();

    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-fill text-ink-soft"
        >
          <WarningCircle size={18} weight="bold" />
        </span>
        <p className="text-sm font-medium text-ink">Could not load this member</p>
        <p className="mt-1 text-xs text-ink-muted">{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!member) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <PageBreadcrumb label={`${member.firstName} ${member.lastName}`} />
      <AccessGate resource="education">
        <ProfileContent member={member} />
      </AccessGate>
    </>
  );
}
