'use client';

import {
  ArrowsClockwise,
  CalendarCheck,
  ChatCircleDots,
  PencilSimple,
  Trash,
  UserCircleCheck,
  WarningCircle,
  X,
} from '@phosphor-icons/react/dist/ssr';
import { App, Button, Drawer, Popover } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ConvertGuestModal } from '@/components/club-admin/convert-guest-modal';
import { ContactLogsDrawer } from '@/components/people/contact-logs-drawer';
import { GuestEditPanel } from '@/components/people/guest-edit-panel';
import { VisitLogsDrawer } from '@/components/people/visit-logs-drawer';
import { ReadOnly } from '@/components/permissions/read-only';
import type { Guest, GuestStage } from '@/lib/people/guests';
import { GUEST_STAGES, getGuestFullName } from '@/lib/people/guests';
import { useDeleteGuestMutation, useUpdateGuestMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

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
  const fullName = getGuestFullName(guest);
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
  const [convertOpen, setConvertOpen] = useState(false);
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

  const convert = () => {
    close();
    setConvertOpen(true);
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
        <ConvertGuestModal
          open={convertOpen}
          onClose={() => setConvertOpen(false)}
          guestId={guest.id}
        />
      </>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="rightTop"
        arrow={false}
        styles={{ container: { padding: 0 } }}
        content={menu}
      >
        {triggerButton}
      </Popover>
      <ConvertGuestModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        guestId={guest.id}
      />
    </>
  );
}

interface GuestActionsProps {
  guest: Guest;
}

/** Three vertical actions under the hero: Move stage (opens the stage menu),
 * Edit (opens the right-side edit panel), Delete (confirms then removes the
 * record and routes back to the People index). */
export function GuestActions({ guest }: GuestActionsProps) {
  const { message, modal } = App.useApp();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteGuest, { isLoading: isDeleting }] = useDeleteGuestMutation();

  const fullName = getGuestFullName(guest);

  /* Runs the delete inside the confirm modal's `onOk` so the dialog stays open
   * with its own spinner while the request is in flight — the user gets a
   * single interaction rather than a modal that closes then something happens
   * elsewhere. Navigating out before the toast fires keeps the profile from
   * flashing an error state on a record that is on its way out. */
  const confirmDelete = () => {
    modal.confirm({
      title: `Delete ${fullName}?`,
      icon: <WarningCircle size={20} weight="fill" className="text-rose-600" />,
      content: (
        <p className="text-sm text-ink-soft">
          This removes {fullName} from the guest list. Their visit count and any notes on file are
          discarded. This action cannot be undone.
        </p>
      ),
      okText: 'Delete guest',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteGuest(guest.id).unwrap();
          message.success(`${fullName} was deleted`);
          router.push('/people');
        } catch (err) {
          message.error(getApiErrorMessage(err));
          /* Rethrow so antd keeps the modal open on failure — the user sees the
           * error toast and can retry from the same dialog. */
          throw err;
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Guest actions"
        className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas p-3"
      >
        <SectionTitle>Actions</SectionTitle>
        <ReadOnly resource="guest" display="block" className="flex flex-col gap-2">
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
        </ReadOnly>
        <ReadOnly resource="guest" action="delete" display="block">
          <Button
            block
            danger
            size="middle"
            loading={isDeleting}
            onClick={confirmDelete}
            icon={<Trash size={16} weight="bold" />}
            className="justify-start"
          >
            Delete
          </Button>
        </ReadOnly>
      </section>

      <GuestActivity guest={guest} />

      <GuestEditPanel guest={guest} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}

/** Section header used inside the small p-3 action/activity boxes. Tightened
 * against the parent's padding so the label sits flush with the button icons
 * beneath it. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pb-1 text-sm font-semibold text-ink">{children}</h2>;
}

interface GuestActivityProps {
  guest: Guest;
}

/** Second stacked box beneath Actions — the "history" affordances (visits,
 * contacts). The panels themselves are stubbed placeholders for now; contents
 * arrive with the follow-up spec. */
function GuestActivity({ guest }: GuestActivityProps) {
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);

  return (
    <>
      <section
        aria-label="Guest activity"
        className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas p-3"
      >
        <SectionTitle>Activity</SectionTitle>
        <Button
          block
          size="middle"
          onClick={() => setVisitsOpen(true)}
          icon={<CalendarCheck size={16} weight="bold" />}
          className="justify-start"
        >
          See Visit Logs
        </Button>
        <Button
          block
          size="middle"
          onClick={() => setContactsOpen(true)}
          icon={<ChatCircleDots size={16} weight="bold" />}
          className="justify-start"
        >
          See Contact Logs
        </Button>
      </section>

      <VisitLogsDrawer guest={guest} open={visitsOpen} onClose={() => setVisitsOpen(false)} />
      <ContactLogsDrawer guest={guest} open={contactsOpen} onClose={() => setContactsOpen(false)} />
    </>
  );
}
