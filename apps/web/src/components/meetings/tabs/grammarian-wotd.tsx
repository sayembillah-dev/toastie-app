'use client';

import { Minus, Plus, TrashSimple, UserPlus, X } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import { useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import { assigneeToDraft } from '@/components/meetings/tabs/ah-counter-shared';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import type { GrammarianWotdSpeaker } from '@/lib/meetings/role-state';
import type { Guest } from '@/lib/people/guests';

type SpeakerDraft = { memberId?: string; guestId?: string; name: string };

interface WotdSpeakerRowProps {
  speaker: GrammarianWotdSpeaker;
  word: string;
  onAdjust: (delta: number) => void;
  onDelete: () => void;
}

/** One tracked speaker: name on the left, − count + stepper on the right.
 * A single counter fits inline, so unlike the Ah Counter there's no sheet —
 * tapping + right on the row is the whole interaction. */
function WotdSpeakerRow({ speaker, word, onAdjust, onDelete }: WotdSpeakerRowProps) {
  const hint = word ? `“${word}”` : 'the word of the day';
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas py-1.5 pl-4 pr-1.5">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{speaker.name}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={speaker.count === 0}
          aria-label={`Decrease ${hint} count for ${speaker.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-muted transition-colors hover:bg-fill disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <Minus size={14} weight="bold" />
        </button>
        <span
          aria-live="polite"
          className="w-7 text-center font-mono text-base font-semibold tabular-nums text-ink"
        >
          {speaker.count}
        </span>
        <button
          type="button"
          onClick={() => onAdjust(1)}
          aria-label={`Count ${hint} for ${speaker.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>
      <Button
        type="text"
        size="small"
        aria-label={`Remove ${speaker.name}`}
        icon={<TrashSimple size={16} className="text-ink-muted" />}
        onClick={onDelete}
      />
    </div>
  );
}

interface AddSpeakerFormProps {
  members: Member[];
  guests: Guest[];
  onCommit: (draft: SpeakerDraft) => void;
  onCancel: () => void;
}

/** Inline add-person form — stacks vertically on phones, one row from `sm`
 * up. On the public share page the roster queries are skipped, so
 * `AssigneeSelect`'s freeform guest typing is the way names get in there. */
function AddSpeakerForm({ members, guests, onCommit, onCancel }: AddSpeakerFormProps) {
  const [pending, setPending] = useState<Assignee | null>(null);

  function commit() {
    if (!pending) return;
    onCommit(assigneeToDraft(pending, members));
    setPending(null);
  }

  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-canvas p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <AssigneeSelect
            value={pending}
            onChange={setPending}
            members={members}
            guests={guests}
            placeholder="Search or type a name…"
            ariaLabel="Person tracking the word of the day"
            variant="outlined"
            size="large"
          />
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <Button type="primary" size="large" onClick={commit} disabled={!pending} block>
            Add
          </Button>
          <Button
            size="large"
            aria-label="Cancel adding person"
            icon={<X size={16} className="text-ink-muted" />}
            onClick={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

export interface WotdSectionProps {
  /** The word of the day, read from the meeting record (Theme tab owns it).
   * Empty string when the meeting has none set yet. */
  word: string;
  speakers: GrammarianWotdSpeaker[];
  availableMembers: Member[];
  availableGuests: Guest[];
  onAddSpeaker: (draft: SpeakerDraft) => void;
  onAdjust: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}

/** Word-of-the-day tracker — the word itself comes from the Theme tab (shown
 * read-only here so the two can never drift); counting per speaker is one
 * tap. One responsive component for desktop and phones; all state lives in
 * `GrammarianView`. */
export function WotdSection({
  word,
  speakers,
  availableMembers,
  availableGuests,
  onAddSpeaker,
  onAdjust,
  onDelete,
}: WotdSectionProps) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="rounded-2xl border border-line bg-sidebar p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
            Word of the day
          </p>
          {word ? (
            <p className="rounded-lg border border-line bg-canvas px-3 py-2 text-lg font-semibold text-ink">
              {word}
            </p>
          ) : (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-xs text-ink-muted">
              The word of the day hasn&rsquo;t been set for this meeting yet — it comes from the
              Theme section.
            </p>
          )}
        </div>

        {speakers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {speakers.map((speaker) => (
              <WotdSpeakerRow
                key={speaker.id}
                speaker={speaker}
                word={word}
                onAdjust={(delta) => onAdjust(speaker.id, delta)}
                onDelete={() => onDelete(speaker.id)}
              />
            ))}
          </div>
        ) : null}

        {adding ? (
          <AddSpeakerForm
            members={availableMembers}
            guests={availableGuests}
            onCommit={(draft) => {
              onAddSpeaker(draft);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <Button
            block
            type="dashed"
            icon={<UserPlus size={14} weight="bold" />}
            onClick={() => setAdding(true)}
          >
            Add person
          </Button>
        )}
      </div>
    </section>
  );
}
