'use client';

import { ArrowRight, Clock, Plus, TrashSimple } from '@phosphor-icons/react/dist/ssr';
import type { InputRef } from 'antd';
import { Button, Input } from 'antd';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';

import { ShareRoleButton } from '@/components/meetings/tabs/share-role-button';
import {
  type GrammarianEntry,
  parseRoleState,
  readRoleStateRaw,
  subscribeToRoleState,
  updateRoleState,
} from '@/lib/meetings/role-state';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface GrammarianViewProps {
  meetingId: string;
  showShare: boolean;
}

/** Shared interactive view — used by the in-app Grammarian tab and by the
 * public share page. State lives in the role-state store, keyed by meeting,
 * so both surfaces stay in sync via `useSyncExternalStore`. */
export function GrammarianView({ meetingId, showShare }: GrammarianViewProps) {
  const subscribe = useCallback(
    (notify: () => void) => subscribeToRoleState('grammarian', meetingId, notify),
    [meetingId],
  );
  const raw = useSyncExternalStore(
    subscribe,
    () => readRoleStateRaw('grammarian', meetingId),
    () => null,
  );
  const state = parseRoleState('grammarian', raw);
  const entries = state.entries;

  const [said, setSaid] = useState('');
  const [corrected, setCorrected] = useState('');
  const saidRef = useRef<InputRef>(null);

  const canAdd = said.trim().length > 0 && corrected.trim().length > 0;

  function handleAdd() {
    if (!canAdd) return;
    const entry: GrammarianEntry = {
      id: crypto.randomUUID(),
      said: said.trim(),
      corrected: corrected.trim(),
      createdAt: Date.now(),
    };
    updateRoleState('grammarian', meetingId, (previous) => ({
      entries: [entry, ...previous.entries],
    }));
    setSaid('');
    setCorrected('');
    saidRef.current?.focus();
  }

  function handleDelete(id: string) {
    updateRoleState('grammarian', meetingId, (previous) => ({
      entries: previous.entries.filter((entry) => entry.id !== id),
    }));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey && canAdd) {
      event.preventDefault();
      handleAdd();
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-line bg-canvas p-5 sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">Grammarian log</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Catch slips as they happen — write what was said, what it should be, and press Add.
              Each entry is stamped with the time it was logged.
            </p>
          </div>
          {showShare ? (
            <ShareRoleButton
              meetingId={meetingId}
              kind="grammarian"
              roleLabel="Grammarian"
              ariaLabel="Share grammarian role"
            />
          ) : null}
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            ref={saidRef}
            size="large"
            placeholder="What was said"
            aria-label="What was said"
            value={said}
            onChange={(event) => setSaid(event.target.value)}
            onKeyDown={handleKeyDown}
            className="md:flex-1"
          />
          <ArrowRight size={16} aria-hidden className="hidden shrink-0 text-ink-muted md:block" />
          <Input
            size="large"
            placeholder="What it should be"
            aria-label="What it should be"
            value={corrected}
            onChange={(event) => setCorrected(event.target.value)}
            onKeyDown={handleKeyDown}
            className="md:flex-1"
          />
          <Button
            type="primary"
            size="large"
            icon={<Plus size={16} weight="bold" />}
            disabled={!canAdd}
            onClick={handleAdd}
            className="md:shrink-0"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="text-sm font-medium text-ink">No mistakes logged yet</p>
            <p className="mt-1 text-xs text-ink-muted">
              Every entry you add lands at the top of this list with its timestamp.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words rounded-lg bg-red-50 px-2.5 py-1 text-sm text-red-900 line-through decoration-red-400/70">
                    {entry.said}
                  </span>
                  <ArrowRight size={14} aria-hidden className="shrink-0 text-ink-muted" />
                  <span className="min-w-0 break-words rounded-lg bg-emerald-50 px-2.5 py-1 text-sm text-emerald-900">
                    {entry.corrected}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <time
                    dateTime={new Date(entry.createdAt).toISOString()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted"
                  >
                    <Clock size={12} weight="bold" />
                    {TIME_FMT.format(new Date(entry.createdAt))}
                  </time>
                  <Button
                    type="text"
                    size="small"
                    aria-label={`Delete entry: ${entry.said} → ${entry.corrected}`}
                    onClick={() => handleDelete(entry.id)}
                    icon={<TrashSimple size={16} className="text-ink-muted" />}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface GrammarianTabProps {
  meetingId: string;
}

/** Grammarian tab — thin wrapper around the shared view so the QR share button
 * only shows inside the club-member surface. */
export function GrammarianTab({ meetingId }: GrammarianTabProps) {
  return <GrammarianView meetingId={meetingId} showShare />;
}
