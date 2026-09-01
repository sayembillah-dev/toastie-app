'use client';

import {
  Buildings,
  CaretLeft,
  CaretRight,
  EnvelopeSimple,
  MagnifyingGlass,
  SignOut,
} from '@phosphor-icons/react/dist/ssr';
import { App, Empty, Input, Modal, Skeleton } from 'antd';
import Image from 'next/image';
import { useMemo, useState } from 'react';

import { useSessionRefresh } from '@/components/session-provider';
import { writeStoredContext } from '@/lib/auth/token-storage';
import { useSignOut } from '@/lib/auth/use-sign-out';
import {
  type PublicClub,
  useGetPublicClubDirectoryQuery,
  useJoinClubByCodeMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

import toastieLogo from '../../../assets/toastie.svg';

/** Landing screen for a signed-in user with no memberships and no org
 * assignments — the state a freshly-registered account is in before their
 * first invite is accepted, join request approved, or club code redeemed.
 *
 * Two concrete paths forward: browse the directory (informational only —
 * the request-to-join pipeline is a later slice) or paste a code a Club
 * Admin shared directly, which joins immediately as a plain Member. */
export function OnboardingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-6">
      {/* No app shell here, so the rail's logout control isn't available —
       * without this, a person signed into the wrong account has no way out. */}
      <SignOutButton />
      <div className="w-full max-w-xl rounded-3xl border border-line bg-canvas p-10 shadow-[0_20px_50px_-24px_rgba(28,28,28,0.16)] sm:p-12">
        <div className="mb-8 flex items-center gap-2.5">
          <Image src={toastieLogo} alt="" aria-hidden className="h-9 w-auto" priority />
          <span className="text-base font-semibold text-ink">Toastie</span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome to Toastie.</h1>
        <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-ink-soft">
          You&rsquo;re signed in but not yet part of a club. Choose how you&rsquo;d like to get
          started.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <BrowseClubsAction />
          <PasteCodeAction />
        </div>

        <p className="mt-8 text-xs text-ink-muted">
          Once you&rsquo;re a member of a club, this screen goes away and the dashboard becomes your
          home.
        </p>
      </div>
    </div>
  );
}

function SignOutButton() {
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  async function handleClick() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // The router.replace inside signOut navigates away; reset only matters
      // if that somehow doesn't happen (e.g. navigation aborted).
      setSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={signingOut}
      className="fixed top-5 right-5 flex items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 py-2 text-sm font-medium text-ink-soft shadow-sm transition-colors hover:border-line-strong hover:text-ink disabled:opacity-60"
    >
      <SignOut size={16} />
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

function BrowseClubsAction() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-start gap-4 rounded-2xl border border-line px-5 py-4 text-left transition-colors hover:border-line-strong hover:bg-fill/60"
      >
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-100">
          <MagnifyingGlass size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <span className="text-[15px] font-medium text-ink">Browse clubs</span>
          <span className="text-sm text-ink-muted">
            See every club on Toastie and what they&rsquo;re about.
          </span>
        </span>
        <CaretRight
          size={16}
          className="mt-2.5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink-soft"
        />
      </button>
      <ClubDirectoryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PasteCodeAction() {
  const { message } = App.useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joinClubByCode, { isLoading }] = useJoinClubByCodeMutation();
  const refreshSession = useSessionRefresh();

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const result = await joinClubByCode(trimmed).unwrap();
      writeStoredContext(`club:${result.clubId}`);
      message.success(`Welcome to ${result.clubName}`);
      // Pull the fresh session in-place — `SessionProvider` already mounted
      // for this whole `(app)` layout and won't re-run its own mount effect
      // on a same-layout navigation, so `router.replace('/')` alone would
      // leave the store believing the user is still clubless.
      await refreshSession();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not join with that code'));
    }
  }

  return (
    <div className="rounded-2xl border border-line px-5 py-4">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <EnvelopeSimple size={20} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15px] font-medium text-ink">Paste club code from Club Admin</p>
          <p className="text-sm text-ink-muted">
            A Club Admin already added you? Paste the code they shared and press Enter to join.
          </p>
          <Input.Search
            className="mt-3"
            size="large"
            placeholder="e.g. 25YXMP96"
            enterButton="Join"
            value={code}
            disabled={isLoading}
            loading={isLoading}
            onChange={(e) => setCode(e.target.value)}
            onSearch={() => void handleSubmit()}
          />
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

interface ClubDirectoryModalProps {
  open: boolean;
  onClose: () => void;
}

function ClubDirectoryModal({ open, onClose }: ClubDirectoryModalProps) {
  const { data: clubs, isLoading } = useGetPublicClubDirectoryQuery(undefined, { skip: !open });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PublicClub | null>(null);

  const filtered = useMemo(() => {
    const list = clubs ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((club) => club.name.toLowerCase().includes(q));
  }, [clubs, query]);

  function handleClose() {
    onClose();
    setSelected(null);
    setQuery('');
  }

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      title={selected ? selected.name : 'Browse clubs'}
      destroyOnHidden
    >
      {selected ? (
        <ClubDetail club={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="flex flex-col gap-3">
          <Input
            allowClear
            placeholder="Search by name"
            prefix={<MagnifyingGlass size={14} className="text-ink-muted" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton, never reorders
                <Skeleton key={index} active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                clubs && clubs.length > 0 ? 'No clubs match that search' : 'No clubs listed yet'
              }
            />
          ) : (
            <ul className="flex max-h-90 flex-col gap-2 overflow-y-auto">
              {filtered.map((club) => (
                <li key={club.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(club)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-line-strong hover:bg-fill/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-ink-soft">
                      <Buildings size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {club.name}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {club.areaName ?? 'Unplaced'}
                        {club.clubNumber ? ` · #${club.clubNumber}` : ''}
                      </span>
                    </span>
                    <CaretRight size={14} className="shrink-0 text-ink-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function ClubDetail({ club, onBack }: { club: PublicClub; onBack: () => void }) {
  const rows: { label: string; value: string }[] = [];
  if (club.clubNumber) rows.push({ label: 'Club number', value: club.clubNumber });
  if (club.districtName) rows.push({ label: 'District', value: club.districtName });
  if (club.divisionName) rows.push({ label: 'Division', value: club.divisionName });
  if (club.areaName) rows.push({ label: 'Area', value: club.areaName });

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-ink"
      >
        <CaretLeft size={12} /> Back to all clubs
      </button>

      {rows.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-ink-muted">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">No further details listed for this club yet.</p>
      )}

      <p className="rounded-xl bg-fill px-3.5 py-3 text-xs text-ink-soft">
        Ask this club&rsquo;s admin for a join code to get started — joining straight from this list
        isn&rsquo;t available yet.
      </p>
    </div>
  );
}
