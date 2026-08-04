'use client';

import {
  ArrowsClockwise,
  PencilSimple,
  Trash,
  UserCircleCheck,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Drawer, Popover } from 'antd';
import { useEffect, useState } from 'react';

import { GuestEditPanel } from '@/components/people/guest-edit-panel';
import type { Guest, GuestStage } from '@/lib/people/guests';
import { GUEST_STAGES } from '@/lib/people/guests';
import { useUpdateGuestMutation } from '@/store/api';

/** Above this width the actions column renders the popover; below it, the same
 * menu opens as a bottom sheet. Matches Tailwind's `md` so the layout switch
 * lines up with the grid the rest of the page uses. */
const MOBILE_BREAKPOINT = 768;

/** SSR-safe: starts at `false` (desktop) on the server, then upgrades on the
 * client so the popover-vs-drawer decision only runs where `matchMedia` exists.
 * The trigger button is identical either way, so the initial render never
 * flashes wrong content. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return isMobile;
}

interface MoveStageMenuProps {
  guest: Guest;
  onSelectStage: (stage: GuestStage) => void;
  onConvert: () => void;
  onClose: () => void;
}

/** The stage list on the menu drops the guest's current stage (redundant) and
 * `joined-club` (which the Convert-to-member action owns). */
function eligibleStages(current: GuestStage): (typeof GUEST_STAGES)[number][] {
  return GUEST_STAGES.filter((stage) => stage.id !== current && stage.id !== 'joined-club');
}

function MoveStageMenu({ guest, onSelectStage, onConvert, onClose }: MoveStageMenuProps) {
  const fullName = `${guest.firstName} ${guest.lastName}`;
  const canConvert = Boolean(guest.email);
  const stages = eligibleStages(guest.stage);

  return (
    <div className="w-full sm:w-80">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{fullName}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Move to a different stage</p>
        </div>
        <Button
          type="text"
          size="small"
          aria-label="Close"
          onClick={onClose}
          icon={<X size={14} className="text-ink-muted" />}
        />
      </div>

      <ul className="mt-2 flex flex-col px-2">
        {stages.map((stage) => (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-fill focus:outline-none focus-visible:bg-fill"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: stage.accent }}
              />
              <span className="min-w-0 truncate">{stage.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-1 border-t border-line px-2 pb-3 pt-2">
        <button
          type="button"
          onClick={onConvert}
          disabled={!canConvert}
          title={canConvert ? undefined : 'Add an email first to convert this guest.'}
          className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-fill focus:outline-none focus-visible:bg-fill disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
        >
          <UserCircleCheck
            size={20}
            weight="regular"
            aria-hidden
            className="mt-0.5 shrink-0 text-emerald-700"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">Convert to member</div>
            <div className="mt-0.5 text-xs text-ink-muted">
              Creates their member record — needs an email on file
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

interface MoveStageTriggerProps {
  guest: Guest;
}

function MoveStageTrigger({ guest }: MoveStageTriggerProps) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const [updateGuest, { isLoading }] = useUpdateGuestMutation();

  const close = () => setOpen(false);

  const moveTo = async (stage: GuestStage) => {
    close();
    if (stage === guest.stage) return;
    try {
      await updateGuest({ guestId: guest.id, stage }).unwrap();
    } catch {
      message.error(`Could not move ${guest.firstName} ${guest.lastName}`);
    }
  };

  /* Convert-to-member is a bigger flow (create a member record, retire the
   * guest) that has to wait on product spec — the affordance is here so the
   * menu matches the design, but the write itself is stubbed until then. */
  const convert = () => {
    close();
    message.info('Convert to member — coming soon');
  };

  const menu = (
    <MoveStageMenu guest={guest} onSelectStage={moveTo} onConvert={convert} onClose={close} />
  );

  const triggerButton = (
    <Button
      block
      size="middle"
      loading={isLoading}
      onClick={() => setOpen(true)}
      icon={<ArrowsClockwise size={16} weight="bold" />}
      className="justify-start"
    >
      Move stage
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Drawer
          open={open}
          onClose={close}
          placement="bottom"
          height="auto"
          closable={false}
          styles={{
            body: { padding: 0 },
            /* Rounded top corners so the sheet reads as a card rising from the
             * bottom of the screen rather than a full-width surface. */
            content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          }}
        >
          {menu}
        </Drawer>
      </>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="rightTop"
      arrow={false}
      overlayInnerStyle={{ padding: 0 }}
      content={menu}
    >
      {triggerButton}
    </Popover>
  );
}

interface GuestActionsProps {
  guest: Guest;
}

/** Three vertical actions under the hero: Move stage (opens the stage menu),
 * Edit (opens the left-side edit panel), Delete (placeholder — waiting on
 * spec). */
export function GuestActions({ guest }: GuestActionsProps) {
  const { message } = App.useApp();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <section
      aria-label="Guest actions"
      className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas p-3"
    >
      <MoveStageTrigger guest={guest} />
      <Button
        block
        size="middle"
        onClick={() => setEditOpen(true)}
        icon={<PencilSimple size={16} weight="bold" />}
        className="justify-start"
      >
        Edit
      </Button>
      <Button
        block
        danger
        size="middle"
        onClick={() => message.info('Delete guest — coming soon')}
        icon={<Trash size={16} weight="bold" />}
        className="justify-start"
      >
        Delete
      </Button>

      <GuestEditPanel guest={guest} open={editOpen} onClose={() => setEditOpen(false)} />
    </section>
  );
}
