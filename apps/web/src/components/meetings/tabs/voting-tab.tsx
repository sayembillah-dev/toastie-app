'use client';

import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretDown,
  Check,
  Copy,
  DownloadSimple,
  Eraser,
  LockSimple,
  PencilSimple,
  Plus,
  QrCode,
  Trophy,
  Users,
  WhatsappLogo,
} from '@phosphor-icons/react/dist/ssr';
import {
  App,
  Button,
  Checkbox,
  Input,
  Popconfirm,
  QRCode,
  Select,
  Skeleton,
  Tag,
  Tooltip,
} from 'antd';
import { useMemo, useRef, useState } from 'react';

import { ReadOnly, useReadOnly } from '@/components/permissions/read-only';
import type { Member } from '@/lib/education/members';
import type { Meeting } from '@/lib/meetings/meetings';
import type {
  MeetingVoteResults,
  MeetingVotingStatus,
  VoteCandidate,
  VoteCategory,
  VoteCategoryResults,
  VotingState,
} from '@/lib/meetings/voting';
import { isAutoVoteCategory } from '@/lib/meetings/voting';
import { type Guest, getGuestFullName } from '@/lib/people/guests';
import {
  useClearMeetingVoteCategoryMutation,
  useCloseMeetingVotingMutation,
  useGetGuestsQuery,
  useGetMeetingVoteCandidatesQuery,
  useGetMeetingVoteResultsQuery,
  useGetMembersQuery,
  useOpenMeetingVotingMutation,
  useSetMeetingVoteCandidatesMutation,
} from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

/* How often the results read re-polls. Ballots arrive through the anonymous
 * public endpoint, so nothing on this client invalidates the cache — polling
 * is how the ballot count stays live. Faster while the room is voting; the
 * slow rate otherwise still picks up a Start/Close pressed on another device
 * (the results read carries `status`). */
const RESULTS_POLL_OPEN_MS = 5_000;
const RESULTS_POLL_IDLE_MS = 15_000;

type CandidateInput = { name: string; membershipId?: string; guestId?: string };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

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
  onSave: (category: string, candidates: CandidateInput[]) => void;
}

/** One award's candidate list: closable tags for who's on it, one select for
 * adding. Every change commits immediately — the list is small and the
 * officer is usually pruning it seconds before showing the QR.
 *
 * Self-topping categories (table topics — see `isAutoVoteCategory`) also gain
 * names on their own from the Timer and attendance; a name removed here
 * stays removed. An empty card is tinted so a gap is obvious before Start. */
function CategorySetupCard({ category, members, guests, saving, onSave }: CategorySetupCardProps) {
  const readOnly = useReadOnly('meeting', 'update');
  const auto = isAutoVoteCategory(category.key);
  const empty = category.candidates.length === 0;

  function current(): CandidateInput[] {
    return category.candidates.map((entry) => ({
      name: entry.name,
      membershipId: entry.membershipId ?? undefined,
      guestId: entry.guestId ?? undefined,
    }));
  }

  function handleRemove(candidate: VoteCandidate) {
    onSave(
      category.key,
      current().filter((_entry, index) => category.candidates[index].id !== candidate.id),
    );
  }

  function handleAdd(candidate: CandidateInput) {
    onSave(category.key, [...current(), candidate]);
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${empty ? 'border-amber-300 bg-amber-50/60' : 'border-line bg-canvas'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{category.label}</p>
        {auto && (
          <Tag className="!me-0 !text-[11px]" bordered={false}>
            From Timer
          </Tag>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {empty ? (
          <span className="text-xs font-medium text-amber-700">Add names</span>
        ) : (
          category.candidates.map((candidate) => (
            <Tag
              key={candidate.id}
              closable={!readOnly && !saving}
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
    </div>
  );
}

interface CandidateGridProps {
  meetingId: string;
  categories: VoteCategory[] | undefined;
}

/** The four setup cards, wired to the candidate-list save. Shared by the
 * setup step and the open step's "Edit candidates" section. */
function CandidateGrid({ meetingId, categories }: CandidateGridProps) {
  const { message } = App.useApp();
  const { data: members } = useGetMembersQuery();
  const { data: guests } = useGetGuestsQuery();
  const [setCandidates, { isLoading: saving }] = useSetMeetingVoteCandidatesMutation();

  async function handleSave(category: string, candidates: CandidateInput[]) {
    try {
      await setCandidates({ meetingId, category, candidates }).unwrap();
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not save the candidate list'));
    }
  }

  if (!categories) return <Skeleton active paragraph={{ rows: 3 }} title={false} />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {categories.map((category) => (
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
  );
}

/* ------------------------------------------------------------------ steps */

const STEPS: { state: VotingState; label: string }[] = [
  { state: 'setup', label: 'Candidates' },
  { state: 'open', label: 'Vote' },
  { state: 'closed', label: 'Winners' },
];

/** 1 Candidates → 2 Vote → 3 Winners, driven by the server's voting state. */
function StepIndicator({ state }: { state: VotingState }) {
  const currentIndex = STEPS.findIndex((step) => step.state === state);
  return (
    <ol className="flex items-center gap-2" aria-label="Voting progress">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step.state}
            className="flex min-w-0 flex-1 items-center gap-2"
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                active
                  ? 'bg-ink text-canvas'
                  : done
                    ? 'bg-emerald-500 text-white'
                    : 'bg-fill text-ink-muted'
              }`}
            >
              {done ? <Check size={12} weight="bold" /> : index + 1}
            </span>
            <span
              className={`truncate text-xs ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------- 1: setup */

interface SetupStepProps {
  meetingId: string;
  categories: VoteCategory[] | undefined;
  status: MeetingVotingStatus;
}

/** Step 1 — check the candidate lists, then Start. The server tops every
 * list up from the meeting data on each read, so there is usually nothing
 * to do here but prune. Start can also send the voting link on WhatsApp to
 * everyone checked in — once per meeting. */
function SetupStep({ meetingId, categories, status }: SetupStepProps) {
  const { message } = App.useApp();
  const readOnly = useReadOnly('meeting', 'update');
  const [openVoting, { isLoading: opening }] = useOpenMeetingVotingMutation();
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  const { whatsapp } = status;
  const canSend = whatsapp.available && !whatsapp.sentAt && whatsapp.recipients > 0;

  async function handleStart() {
    try {
      const { whatsappQueued } = await openVoting({
        meetingId,
        notifyWhatsapp: canSend && sendWhatsapp,
      }).unwrap();
      message.success(
        whatsappQueued > 0
          ? `Voting is open — link sent to ${plural(whatsappQueued, 'person', 'people')} on WhatsApp`
          : 'Voting is open',
      );
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not start voting'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <CandidateGrid meetingId={meetingId} categories={categories} />

      {readOnly ? (
        <p className="text-xs text-ink-muted">Voting hasn&apos;t started yet.</p>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-ink-soft">
            {!whatsapp.available ? null : whatsapp.sentAt ? (
              <span className="flex items-center gap-1.5">
                <WhatsappLogo size={15} className="text-emerald-600" />
                Link already sent on WhatsApp
              </span>
            ) : whatsapp.recipients === 0 ? (
              <Checkbox checked={false} disabled>
                No one checked in has a WhatsApp number yet
              </Checkbox>
            ) : (
              <Checkbox checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)}>
                Also send the link on WhatsApp to {plural(whatsapp.recipients, 'person', 'people')}{' '}
                here
              </Checkbox>
            )}
          </div>
          <Button type="primary" size="large" loading={opening} onClick={handleStart}>
            Start voting
          </Button>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- 2: open */

interface OpenStepProps {
  meeting: Meeting;
  categories: VoteCategory[] | undefined;
  status: MeetingVotingStatus;
  results: MeetingVoteResults | undefined;
}

/** Step 2 — the room votes. QR up front, a live ballot count, and no
 * per-candidate tallies: showing who's ahead while people are still voting
 * would sway the vote. Candidates stay editable behind a toggle for a late
 * fix (a name typo, a forgotten speaker). */
function OpenStep({ meeting, categories, status, results }: OpenStepProps) {
  const { message } = App.useApp();
  const readOnly = useReadOnly('meeting', 'update');
  const [closeVoting, { isLoading: closing }] = useCloseMeetingVotingMutation();
  const [editing, setEditing] = useState(false);

  const ballots = results?.totalBallots ?? 0;
  const delivery = status.whatsapp.delivery;

  async function handleClose() {
    try {
      await closeVoting(meeting.id).unwrap();
      message.success('Voting closed');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not close voting'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SharePanel meeting={meeting} />

      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-canvas p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Users size={20} weight="bold" className="text-ink-muted" />
            {!results
              ? 'Counting…'
              : ballots === 0
                ? 'No votes yet'
                : `${plural(ballots, 'person has', 'people have')} voted`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <LockSimple size={13} className="shrink-0" />
            Results stay hidden until you close voting.
          </p>
          {delivery && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
              <WhatsappLogo size={13} className="shrink-0 text-emerald-600" />
              WhatsApp: sent {delivery.sent} of {delivery.queued}
              {delivery.failed > 0 && (
                <span className="text-red-600">· {delivery.failed} failed</span>
              )}
            </p>
          )}
        </div>
        {!readOnly && (
          <Button type="primary" size="large" loading={closing} onClick={handleClose}>
            Close voting &amp; show winners
          </Button>
        )}
      </section>

      {!readOnly && (
        <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-ink"
            aria-expanded={editing}
            onClick={() => setEditing((value) => !value)}
          >
            <span className="flex items-center gap-2">
              <PencilSimple size={16} weight="bold" className="text-ink-muted" />
              Edit candidates
            </span>
            <CaretDown
              size={14}
              className={`text-ink-muted transition-transform ${editing ? 'rotate-180' : ''}`}
            />
          </button>
          {editing && (
            <div className="mt-4">
              <CandidateGrid meetingId={meeting.id} categories={categories} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ 3: closed */

/** One award's full tally — the leader(s) wear the trophy, every bar sizes
 * against the top count. */
function TallyBars({ category }: { category: VoteCategoryResults }) {
  const ranked = [...category.candidates].sort(
    (a, b) => b.votes - a.votes || a.name.localeCompare(b.name),
  );
  const top = ranked[0]?.votes ?? 0;

  if (ranked.length === 0) {
    return <p className="text-xs text-ink-muted">No options on this ballot.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
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
  );
}

interface WinnerCardProps {
  meetingId: string;
  category: VoteCategoryResults;
}

/** One award's winner — name(s) large, ties joined with "&" — with the full
 * tally behind a toggle. Clear (officers only) lives inside the tally: it
 * wipes every ballot's pick in this category (test votes, a re-run) while
 * the candidates stay put, so it shouldn't sit next to the headline. */
function WinnerCard({ meetingId, category }: WinnerCardProps) {
  const { message } = App.useApp();
  const readOnly = useReadOnly('meeting', 'update');
  const [clearCategory, { isLoading: clearing }] = useClearMeetingVoteCategoryMutation();
  const [expanded, setExpanded] = useState(false);

  const top = category.candidates.reduce((max, c) => Math.max(max, c.votes), 0);
  const winners = top > 0 ? category.candidates.filter((c) => c.votes === top) : [];

  async function handleClear() {
    try {
      const { cleared } = await clearCategory({ meetingId, category: category.key }).unwrap();
      message.success(
        cleared === 0
          ? `No votes to clear for ${category.label}`
          : `Cleared ${plural(cleared, 'vote', 'votes')} for ${category.label}`,
      );
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not clear votes'));
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-canvas p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          <Trophy size={14} weight="fill" className="text-amber-500" />
          {category.label}
        </p>
        {winners.length > 1 && (
          <Tag color="gold" className="!me-0">
            Tie
          </Tag>
        )}
      </div>

      {winners.length === 0 ? (
        <p className="mt-2 text-lg font-semibold text-ink-muted">No votes</p>
      ) : (
        <>
          <p className="mt-2 text-xl font-bold leading-tight text-ink">
            {winners.map((winner) => winner.name).join(' & ')}
          </p>
          <p className="mt-1 text-xs tabular-nums text-ink-soft">
            {plural(top, 'vote', 'votes')}
            {category.totalVotes > 0 ? ` of ${category.totalVotes}` : ''}
          </p>
        </>
      )}

      <button
        type="button"
        className="mt-3 flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        Full tally
        <CaretDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="mt-3 border-t border-line pt-3">
          <TallyBars category={category} />
          {!readOnly && (
            <div className="mt-3 flex justify-end">
              <Popconfirm
                title={`Clear votes for "${category.label}"?`}
                description="Every pick in this category is wiped. Candidates stay on the ballot."
                okText="Clear"
                okButtonProps={{ danger: true }}
                onConfirm={handleClear}
                disabled={category.totalVotes === 0}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  disabled={category.totalVotes === 0 || clearing}
                  icon={<Eraser size={14} />}
                >
                  Clear votes
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ClosedStepProps {
  meetingId: string;
  results: MeetingVoteResults | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}

/** Step 3 — the winners, one card per award. Reopen goes back to step 2
 * without re-sending the WhatsApp link. */
function ClosedStep({ meetingId, results, refreshing, onRefresh }: ClosedStepProps) {
  const { message } = App.useApp();
  const readOnly = useReadOnly('meeting', 'update');
  const [openVoting, { isLoading: reopening }] = useOpenMeetingVotingMutation();

  async function handleReopen() {
    try {
      await openVoting({ meetingId, notifyWhatsapp: false }).unwrap();
      message.success('Voting reopened');
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Could not reopen voting'));
    }
  }

  if (!results) {
    return (
      <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
        <Skeleton active paragraph={{ rows: 4 }} title={{ width: 180 }} />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-soft">
          Voting closed · {plural(results.totalBallots, 'ballot', 'ballots')}
        </p>
        <div className="flex items-center gap-1">
          <Tooltip title="Refresh results">
            <Button
              type="text"
              size="small"
              aria-label="Refresh results"
              icon={<ArrowsClockwise size={16} className={refreshing ? 'animate-spin' : ''} />}
              onClick={onRefresh}
            />
          </Tooltip>
          {!readOnly && (
            <Button
              icon={<ArrowCounterClockwise size={16} />}
              loading={reopening}
              onClick={handleReopen}
            >
              Reopen voting
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {results.categories.map((category) => (
          <WinnerCard key={category.key} meetingId={meetingId} category={category} />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- tab */

interface VotingTabProps {
  meeting: Meeting;
}

/** Voting tab — the meeting's "best of the evening" ballot, as three steps
 * driven by the server's voting state: 1 check the candidates and Start,
 * 2 share the QR while the room votes, 3 close and read out the winners.
 * The ballot itself is the public page at `/meetings/:id/vote`. */
export function VotingTab({ meeting }: VotingTabProps) {
  const meetingId = meeting.id;

  const { data: setup, isLoading: setupLoading } = useGetMeetingVoteCandidatesQuery(meetingId);
  /* Status rides on both reads. The results read is the polled one, so it
   * wins when present — a Start/Close from another device lands here. */
  const [pollState, setPollState] = useState<VotingState>('setup');
  const {
    data: results,
    refetch,
    isFetching,
  } = useGetMeetingVoteResultsQuery(meetingId, {
    pollingInterval: pollState === 'open' ? RESULTS_POLL_OPEN_MS : RESULTS_POLL_IDLE_MS,
  });
  const status = results?.status ?? setup?.status;
  if (status && status.state !== pollState) setPollState(status.state);

  if (setupLoading || !status) {
    return (
      <section className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
        <Skeleton active paragraph={{ rows: 4 }} title={{ width: 180 }} />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator state={status.state} />

      {status.state === 'setup' && (
        <SetupStep meetingId={meetingId} categories={setup?.categories} status={status} />
      )}
      {status.state === 'open' && (
        <OpenStep
          meeting={meeting}
          categories={setup?.categories}
          status={status}
          results={results}
        />
      )}
      {status.state === 'closed' && (
        <ClosedStep
          meetingId={meetingId}
          results={results}
          refreshing={isFetching}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
}
