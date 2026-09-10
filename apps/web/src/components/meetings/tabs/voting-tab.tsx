'use client';

import {
  ArrowsClockwise,
  ChartBar,
  Copy,
  DownloadSimple,
  Eraser,
  Info,
  Plus,
  QrCode,
  Trophy,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Input, Popconfirm, QRCode, Select, Skeleton, Tag, Tooltip } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ReadOnly, useReadOnly } from '@/components/permissions/read-only';
import type { Member } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import type { VoteCandidate, VoteCategory } from '@/lib/meetings/voting';
import { isAutoVoteCategory } from '@/lib/meetings/voting';
import { type Guest, getGuestFullName } from '@/lib/people/guests';
import {
  useClearMeetingVoteCategoryMutation,
  useGetGuestsQuery,
  useGetMeetingVoteCandidatesQuery,
  useGetMeetingVoteResultsQuery,
  useGetMembersQuery,
  useSetMeetingVoteCandidatesMutation,
  useSyncMeetingVoteCandidatesMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* How often the results board re-polls — ballots arrive through the
 * anonymous public endpoint, so nothing on this client invalidates the
 * cache and polling is how the board stays live while the room votes. */
const RESULTS_POLL_MS = 15_000;

/* ------------------------------------------------------------------ share */

interface SharePanelProps {
  meeting: Meeting;
}

/** The QR + link officers put in front of the room. Inline rather than
 * behind a modal — the projector use-case is "leave the QR on screen while
 * people scan", which a modal's overlay would fight. */
function SharePanel({ meeting }: SharePanelProps) {
  const { message } = App.useApp();
  const qrWrapRef = useRef<HTMLDivElement>(null);

  const url = useMemo(() => {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
    return `${origin}/meetings/${meeting.id}/vote?t=${encodeURIComponent(meeting.shareToken)}`;
  }, [meeting.id, meeting.shareToken]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      message.success('Voting link copied');
    } catch {
      message.error('Could not copy link');
    }
  }

  function handleDownload() {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `meeting-${meeting.meetingNumber}-vote-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return (
    <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          ref={qrWrapRef}
          className="mx-auto shrink-0 rounded-2xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:mx-0"
        >
          <QRCode
            value={url || ' '}
            size={168}
            bordered={false}
            errorLevel="M"
            color="#1c1c1c"
            bgColor="#ffffff"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <QrCode size={16} weight="bold" className="text-ink-muted" />
            Voting link
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Everyone in the room scans the code or opens the link to vote. Votes are anonymous and
            limited to one ballot per device — a re-vote simply replaces the earlier one.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Input readOnly value={url} className="!bg-fill !text-ink" />
            <Button icon={<Copy size={16} />} onClick={handleCopy} aria-label="Copy voting link">
              Copy
            </Button>
          </div>
          <Button
            className="mt-2"
            icon={<DownloadSimple size={16} weight="bold" />}
            onClick={handleDownload}
          >
            Download QR as image
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ ballot setup */

interface AddCandidateSelectProps {
  /** Names/links already on this category's list, for exclusion. */
  existing: VoteCandidate[];
  members: Member[];
  guests: Guest[];
  onAdd: (candidate: { name: string; membershipId?: string; guestId?: string }) => void;
}

/** One control for both cases: pick a roster member / pipeline guest, or
 * type a name that isn't in either and add it free-form (a walk-in the
 * check-in never captured). Custom entries surface as an `Add "<name>"`
 * option once the search text matches nothing exactly. */
function AddCandidateSelect({ existing, members, guests, onAdd }: AddCandidateSelectProps) {
  const [search, setSearch] = useState('');

  const takenMembers = new Set(existing.map((c) => c.membershipId).filter(Boolean));
  const takenGuests = new Set(existing.map((c) => c.guestId).filter(Boolean));
  const takenNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

  const options = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    for (const member of members) {
      if (takenMembers.has(member.id)) continue;
      list.push({ value: `m:${member.id}`, label: `${member.firstName} ${member.lastName}` });
    }
    for (const guest of guests) {
      if (takenGuests.has(guest.id)) continue;
      list.push({ value: `g:${guest.id}`, label: `${getGuestFullName(guest)} (Guest)` });
    }
    const typed = search.trim().replace(/\s+/g, ' ');
    if (typed && !takenNames.has(typed.toLowerCase())) {
      const exact = list.some((option) => option.label.toLowerCase() === typed.toLowerCase());
      if (!exact) list.push({ value: `n:${typed}`, label: `Add "${typed}"` });
    }
    return list;
    /* takenMembers/takenGuests/takenNames are rebuilt per render but stable
     * in content for a given `existing`; eslint's exhaustive-deps accepts
     * them through `existing`. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, members, guests, search]);

  return (
    <Select
      className="w-full"
      size="middle"
      showSearch
      value={null}
      searchValue={search}
      onSearch={setSearch}
      onChange={(value: string) => {
        setSearch('');
        if (value.startsWith('m:')) {
          const member = members.find((entry) => entry.id === value.slice(2));
          if (member) {
            onAdd({ name: `${member.firstName} ${member.lastName}`, membershipId: member.id });
          }
        } else if (value.startsWith('g:')) {
          const guest = guests.find((entry) => entry.id === value.slice(2));
          if (guest) onAdd({ name: getGuestFullName(guest), guestId: guest.id });
        } else if (value.startsWith('n:')) {
          onAdd({ name: value.slice(2) });
        }
      }}
      options={options}
      placeholder="Add a person…"
      suffixIcon={<Plus size={14} className="text-ink-muted" />}
      aria-label="Add a candidate"
    />
  );
}

interface CategorySetupCardProps {
  category: VoteCategory;
  members: Member[];
  guests: Guest[];
  saving: boolean;
  onSave: (
    category: string,
    candidates: { name: string; membershipId?: string; guestId?: string }[],
  ) => void;
}

/** One award's candidate list: closable tags for who's on it, one select for
 * adding. Every change commits immediately — the list is small and the
 * officer is usually pruning it seconds before showing the QR.
 *
 * Self-maintaining categories (table topics — see `isAutoVoteCategory`)
 * render read-only for everyone: the server keeps that list in step with
 * attendance, so there is nothing to add or prune by hand. */
function CategorySetupCard({ category, members, guests, saving, onSave }: CategorySetupCardProps) {
  const readOnly = useReadOnly('meeting', 'update');
  const auto = isAutoVoteCategory(category.key);

  function handleRemove(candidate: VoteCandidate) {
    onSave(
      category.key,
      category.candidates
        .filter((entry) => entry.id !== candidate.id)
        .map((entry) => ({
          name: entry.name,
          membershipId: entry.membershipId ?? undefined,
          guestId: entry.guestId ?? undefined,
        })),
    );
  }

  function handleAdd(candidate: { name: string; membershipId?: string; guestId?: string }) {
    onSave(category.key, [
      ...category.candidates.map((entry) => ({
        name: entry.name,
        membershipId: entry.membershipId ?? undefined,
        guestId: entry.guestId ?? undefined,
      })),
      candidate,
    ]);
  }

  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <p className="text-sm font-semibold text-ink">{category.question}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">
        {auto
          ? 'Filled automatically — everyone marked present (members + guests)'
          : `${category.candidates.length} option(s)`}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {category.candidates.length === 0 ? (
          <span className="text-xs text-ink-muted">
            {auto
              ? 'No one checked in yet — this fills itself as attendance is marked.'
              : 'No options yet — sync or add below.'}
          </span>
        ) : (
          category.candidates.map((candidate) => (
            <Tag
              key={candidate.id}
              closable={!auto && !readOnly && !saving}
              onClose={(event) => {
                event.preventDefault();
                handleRemove(candidate);
              }}
              className="!me-0 !px-2.5 !py-1 !text-xs"
            >
              {candidate.name}
            </Tag>
          ))
        )}
      </div>

      {!auto && (
        <ReadOnly resource="meeting" action="update" display="block" className="mt-3">
          <div className="mt-3">
            <AddCandidateSelect
              existing={category.candidates}
              members={members}
              guests={guests}
              onAdd={handleAdd}
            />
          </div>
        </ReadOnly>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- results */

/** The live tally. Polls on an interval — see RESULTS_POLL_MS. The leader
 * (everyone tied at the top, provided they have at least one vote) wears the
 * trophy; everyone else's bar sizes against the leader's count. Each card
 * carries a Clear button (officers only) that wipes every ballot's pick in
 * that category — test votes, a re-run after a mix-up — while the
 * candidates stay put. */
function ResultsBoard({ meetingId }: { meetingId: string }) {
  const { message } = App.useApp();
  const readOnly = useReadOnly('meeting', 'update');
  const {
    data: results,
    isLoading,
    refetch,
    isFetching,
  } = useGetMeetingVoteResultsQuery(meetingId, { pollingInterval: RESULTS_POLL_MS });
  const [clearCategory, { isLoading: clearing }] = useClearMeetingVoteCategoryMutation();

  async function handleClear(categoryKey: string, label: string) {
    try {
      const { cleared } = await clearCategory({ meetingId, category: categoryKey }).unwrap();
      message.success(
        cleared === 0
          ? `No votes to clear for ${label}`
          : `Cleared ${cleared} vote${cleared === 1 ? '' : 's'} for ${label}`,
      );
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not clear votes'));
    }
  }

  if (isLoading || !results) {
    return (
      <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
        <Skeleton active paragraph={{ rows: 4 }} title={{ width: 180 }} />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ChartBar size={16} weight="bold" className="text-ink-muted" />
            Results
          </h3>
          <p className="mt-1 text-xs text-ink-soft">
            {results.totalBallots === 0
              ? 'No votes in yet — share the link above when you open voting.'
              : `${results.totalBallots} ballot${results.totalBallots === 1 ? '' : 's'} in · updates automatically`}
          </p>
        </div>
        <Tooltip title="Refresh results">
          <Button
            type="text"
            size="small"
            aria-label="Refresh results"
            icon={<ArrowsClockwise size={16} className={isFetching ? 'animate-spin' : ''} />}
            onClick={() => refetch()}
          />
        </Tooltip>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {results.categories.map((category) => {
          const ranked = [...category.candidates].sort(
            (a, b) => b.votes - a.votes || a.name.localeCompare(b.name),
          );
          const top = ranked[0]?.votes ?? 0;
          return (
            <div key={category.key} className="rounded-xl border border-line bg-sidebar p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink">{category.label}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <p className="text-[11px] tabular-nums text-ink-muted">
                    {category.totalVotes} vote{category.totalVotes === 1 ? '' : 's'}
                  </p>
                  {!readOnly && (
                    <Popconfirm
                      title={`Clear votes for "${category.label}"?`}
                      description="Every pick in this category is wiped. Candidates stay on the ballot."
                      okText="Clear"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleClear(category.key, category.label)}
                      disabled={category.totalVotes === 0}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        disabled={category.totalVotes === 0 || clearing}
                        aria-label={`Clear votes for ${category.label}`}
                        icon={<Eraser size={14} />}
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>

              {ranked.length === 0 ? (
                <p className="mt-3 text-xs text-ink-muted">No options on this ballot yet.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {ranked.map((candidate) => {
                    const leader = top > 0 && candidate.votes === top;
                    const width = top > 0 ? Math.max((candidate.votes / top) * 100, 4) : 0;
                    return (
                      <li key={candidate.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`flex min-w-0 items-center gap-1.5 text-xs ${leader ? 'font-semibold text-ink' : 'text-ink-soft'}`}
                          >
                            {leader ? (
                              <Trophy size={13} weight="fill" className="shrink-0 text-amber-500" />
                            ) : null}
                            <span className="truncate">{candidate.name}</span>
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
                            {candidate.votes}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                          <div
                            className={`h-full rounded-full transition-[width] ${leader ? 'bg-amber-400' : 'bg-slate-400/70'}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- tab */

interface VotingTabProps {
  meeting: Meeting;
}

/** Voting tab — the meeting's "best of the evening" ballot. Officers set the
 * candidate lists (or let "Sync from meeting data" derive them from
 * speakers, evaluators, attendees and role holders), share the QR/link with
 * the room, and watch the anonymous tally come in. The ballot itself is the
 * public page at `/meetings/:id/vote`. */
export function VotingTab({ meeting }: VotingTabProps) {
  const { message } = App.useApp();
  const meetingId = meeting.id;
  const readOnly = useReadOnly('meeting', 'update');

  const { data: setup, isLoading: setupLoading } = useGetMeetingVoteCandidatesQuery(meetingId);
  const { data: members } = useGetMembersQuery();
  const { data: guests } = useGetGuestsQuery();
  const [syncCandidates, { isLoading: syncing }] = useSyncMeetingVoteCandidatesMutation();
  const [setCandidates, { isLoading: saving }] = useSetMeetingVoteCandidatesMutation();

  /* First visit convenience: an untouched ballot (no candidates anywhere)
   * syncs itself from the meeting data so the officer usually has nothing
   * to set up at all. Only attempted once per mount, and never for
   * read-only viewers — the sync is an `update`-gated write. */
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current || !setup || readOnly) return;
    const untouched = setup.categories.every((category) => category.candidates.length === 0);
    if (!untouched) return;
    autoSynced.current = true;
    syncCandidates(meetingId)
      .unwrap()
      .catch((error) => message.error(getApiErrorMessage(error, 'Could not sync candidates')));
  }, [setup, readOnly, syncCandidates, meetingId, message]);

  async function handleSync() {
    try {
      const next = await syncCandidates(meetingId).unwrap();
      const added = next.categories.reduce((sum, c) => sum + c.candidates.length, 0);
      message.success(
        added === 0
          ? 'Ballot is up to date with the meeting data'
          : 'Candidate lists synced from the meeting data',
      );
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not sync candidates'));
    }
  }

  async function handleSave(
    category: string,
    candidates: { name: string; membershipId?: string; guestId?: string }[],
  ) {
    try {
      await setCandidates({ meetingId, category, candidates }).unwrap();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not save the candidate list'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SharePanel meeting={meeting} />

      <ResultsBoard meetingId={meetingId} />

      <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Info size={16} weight="bold" className="text-ink-muted" />
              Contestants
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              Who voters can pick for each award. Sync derives the lists from this meeting&apos;s
              speakers, evaluators and role takers — prune or add by hand afterwards. Table topics
              needs no setup: it always offers everyone marked present, members and guests alike.
            </p>
          </div>
          <ReadOnly resource="meeting" action="update">
            <Button
              icon={<ArrowsClockwise size={16} className={syncing ? 'animate-spin' : ''} />}
              loading={syncing}
              onClick={handleSync}
            >
              Sync from meeting data
            </Button>
          </ReadOnly>
        </div>

        {setupLoading || !setup ? (
          <div className="mt-4">
            <Skeleton active paragraph={{ rows: 3 }} title={false} />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {setup.categories.map((category) => (
              <CategorySetupCard
                key={category.key}
                category={category}
                members={members ?? []}
                guests={guests ?? []}
                saving={saving}
                onSave={handleSave}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
