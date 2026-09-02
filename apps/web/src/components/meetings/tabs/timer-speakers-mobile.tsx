'use client';

import { ClipboardText, Plus, UserPlus, X } from '@phosphor-icons/react/dist/ssr';
import { Button, Drawer, Select } from 'antd';
import { useState } from 'react';

import { AssigneeSelect } from '@/components/education/assignee-select';
import {
  assigneeToDraft,
  computeElapsed,
  SpeakerListRow,
  TimerCard,
} from '@/components/meetings/tabs/timer-shared';
import type { Member } from '@/lib/education/members';
import type { Assignee } from '@/lib/education/planner';
import {
  TIMER_SPEAKER_TYPES,
  type TimerSpeaker,
  type TimerSpeakerType,
} from '@/lib/meetings/role-state';
import type { Guest } from '@/lib/people/guests';

type SpeakerDraft = {
  memberId?: string;
  guestId?: string;
  name: string;
  type: TimerSpeakerType;
};

interface AddSpeakerSheetProps {
  open: boolean;
  members: Member[];
  guests: Guest[];
  onCommit: (draft: SpeakerDraft) => void;
  onClose: () => void;
}

/** Mobile "add a speaker to time" form, presented as a bottom sheet off the
 * FAB. Local draft state resets on every close path (backdrop, Cancel, Add)
 * so the sheet always reopens fresh. */
function AddSpeakerSheet({ open, members, guests, onCommit, onClose }: AddSpeakerSheetProps) {
  const [type, setType] = useState<TimerSpeakerType>('Prepared Speaker');
  const [pending, setPending] = useState<Assignee | null>(null);

  function reset() {
    setType('Prepared Speaker');
    setPending(null);
  }

  function handleCancel() {
    reset();
    onClose();
  }

  function handleCommit() {
    if (!pending) return;
    onCommit({ ...assigneeToDraft(pending, members), type });
    reset();
    onClose();
  }

  return (
    <Drawer
      open={open}
      onClose={handleCancel}
      placement="bottom"
      size="auto"
      /* The timer lives inside the mobile feature drawer; opening this sheet
       * makes rc-drawer tell the parent to push. The parent's own
       * `push={false}` is what actually stops that — this zero-distance
       * config only guards against any future sheet nested inside this one. */
      push={false}
      destroyOnHidden
      title="Add speaker"
      styles={{
        section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: { padding: 16, overflowY: 'auto', maxHeight: '70dvh' },
        footer: {
          paddingInline: 16,
          paddingTop: 12,
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        },
      }}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button size="large" block onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="primary" size="large" block onClick={handleCommit} disabled={!pending}>
            Add Speaker
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="timer-speaker-type" className="mb-1.5 block text-xs font-medium text-ink">
            Speaker type
          </label>
          <Select
            id="timer-speaker-type"
            size="large"
            className="w-full"
            value={type}
            onChange={(value: TimerSpeakerType) => setType(value)}
            options={TIMER_SPEAKER_TYPES.map((entry) => ({ value: entry, label: entry }))}
          />
        </div>
        <div>
          <p id="timer-speaker-name-label" className="mb-1.5 text-xs font-medium text-ink">
            Speaker name
          </p>
          <AssigneeSelect
            value={pending}
            onChange={setPending}
            members={members}
            guests={guests}
            placeholder="Search or type a name…"
            ariaLabel="Speaker name"
            variant="outlined"
            size="large"
          />
        </div>
      </div>
    </Drawer>
  );
}

export interface SpeakerViewMobileProps {
  speakers: TimerSpeaker[];
  activeId: string | null;
  now: number;
  members: Member[];
  guests: Guest[];
  editingId: string | null;
  editingName: string;
  onAdd: (draft: SpeakerDraft) => void;
  onSelect: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onEditingNameChange: (name: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onTakeFromAgenda?: () => void;
}

/** Mobile face of the Timer's Speaker pane — the speaker list stays front
 * and center; tapping a row opens its clock (the shared TimerCard) in a
 * bottom sheet, and adding a speaker moves to a floating action button
 * opening another sheet (the desktop inline form is too cramped on a
 * phone). All state and mutations stay in `TimerView`; this is presentation
 * only. */
export function SpeakerViewMobile({
  speakers,
  activeId,
  now,
  members,
  guests,
  editingId,
  editingName,
  onAdd,
  onSelect,
  onRename,
  onDelete,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  onStart,
  onStop,
  onReset,
  onTakeFromAgenda,
}: SpeakerViewMobileProps) {
  const [addOpen, setAddOpen] = useState(false);
  /* Speed-dial: the + FAB fans out into "Add Speaker" / "Take from agenda". */
  const [fabOpen, setFabOpen] = useState(false);
  /* Which speaker's clock the sheet shows — tapping a row both selects it
   * (role state, so desktop/public stay in sync) and opens the sheet. */
  const [timerOpen, setTimerOpen] = useState(false);
  const active = speakers.find((speaker) => speaker.id === activeId) ?? null;
  const elapsed = active ? computeElapsed(active, now) : 0;

  function handleSelect(id: string) {
    onSelect(id);
    setTimerOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {speakers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-sm font-medium text-ink">No speakers yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            Tap the + button to add the first speaker to time.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {speakers.map((speaker) => (
            <SpeakerListRow
              key={speaker.id}
              speaker={speaker}
              isActive={speaker.id === activeId}
              isEditing={speaker.id === editingId}
              editingName={editingName}
              now={now}
              onSelect={() => handleSelect(speaker.id)}
              onRename={() => onRename(speaker.id)}
              onDelete={() => onDelete(speaker.id)}
              onEditingNameChange={onEditingNameChange}
              onSaveRename={onSaveRename}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}

      {/* Clearance so the FAB never sits on top of the last list row. */}
      <div className="h-20 shrink-0" aria-hidden="true" />

      {addOpen || timerOpen ? null : (
        /* Wrapper owns the fixed positioning — Tailwind's `fixed` class on the
         * Button itself loses to antd's unlayered `.ant-btn { position:
         * relative }` (Tailwind v4 utilities are in a cascade layer), which
         * leaves the button in flow at the wrong spot. */
        <>
          {/* Scrim catches outside taps to collapse the speed-dial. */}
          {fabOpen ? (
            <button
              type="button"
              aria-label="Close add menu"
              onClick={() => setFabOpen(false)}
              className="fixed inset-0 z-30 cursor-default bg-black/10"
            />
          ) : null}
          <div
            className="fixed z-40 flex flex-col items-end gap-3"
            style={{
              right: 'calc(20px + env(safe-area-inset-right))',
              bottom: 'calc(24px + env(safe-area-inset-bottom))',
            }}
          >
            {fabOpen ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setAddOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink shadow-lg"
                >
                  <UserPlus size={16} weight="bold" />
                  Add Speaker
                </button>
                {onTakeFromAgenda ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFabOpen(false);
                      onTakeFromAgenda();
                    }}
                    className="flex items-center gap-2 rounded-full border border-line bg-canvas px-4 py-2.5 text-sm font-medium text-ink shadow-lg"
                  >
                    <ClipboardText size={16} weight="bold" />
                    Take from agenda
                  </button>
                ) : null}
              </>
            ) : null}
            <Button
              type="primary"
              shape="circle"
              aria-label={fabOpen ? 'Close add menu' : 'Add speaker'}
              aria-expanded={fabOpen}
              icon={fabOpen ? <X size={24} weight="bold" /> : <Plus size={24} weight="bold" />}
              onClick={() => setFabOpen((v) => !v)}
              style={{
                width: 56,
                height: 56,
                /* Same story — antd's unlayered box-shadow beats `shadow-lg`. */
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)',
              }}
            />
          </div>
        </>
      )}

      {/* The clock lives in a sheet on mobile — the list stays scannable and
       * the readout gets the full width when it's actually needed. TimerCard
       * is shared with desktop, so the readout/brackets/controls match. */}
      <Drawer
        open={timerOpen && active !== null}
        onClose={() => setTimerOpen(false)}
        placement="bottom"
        size="auto"
        push={false}
        destroyOnHidden
        closable={false}
        /* Deliberate-close only: tapping the backdrop or pressing ESC must
         * not dismiss a running clock — the X button is the single way out. */
        maskClosable={false}
        keyboard={false}
        styles={{
          section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          body: {
            padding: 16,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
            overflowY: 'auto',
            maxHeight: '85dvh',
          },
        }}
      >
        {active ? (
          <div className="relative">
            <button
              type="button"
              aria-label="Close timer"
              onClick={() => setTimerOpen(false)}
              className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-fill text-ink-soft transition-colors hover:bg-fill-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
            >
              <X size={18} weight="bold" />
            </button>
            <TimerCard
              speaker={active}
              elapsed={elapsed}
              onStart={onStart}
              onStop={onStop}
              onReset={onReset}
            />
          </div>
        ) : null}
      </Drawer>

      <AddSpeakerSheet
        open={addOpen}
        members={members}
        guests={guests}
        onCommit={onAdd}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
