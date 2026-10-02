'use client';

import { DeviceMobile, Export, PlusSquare } from '@phosphor-icons/react/dist/ssr';
import { Button } from 'antd';
import { useState, useSyncExternalStore } from 'react';

import {
  getInstallState,
  getServerInstallState,
  isInstallCardSnoozed,
  promptInstall,
  snoozeInstallCard,
  subscribeInstallState,
} from '@/lib/pwa/install';

interface InstallAppCardProps {
  /** The member's role at the next meeting, e.g. "Timer" — makes the pitch
   * concrete when there is one. `null` falls back to the generic copy. */
  myRole: string | null;
}

/** Invites the member to install Toastie to their home screen. Chrome's own
 * mini-infobar is suppressed (see `INSTALL_CAPTURE_SCRIPT`), so this is the
 * install offer on Android/desktop; on iOS, which has no prompt API, it
 * shows the Share → Add to Home Screen steps instead. Renders nothing once
 * installed, when the browser can't install, or while snoozed. */
export function InstallAppCard({ myRole }: InstallAppCardProps) {
  const state = useSyncExternalStore(subscribeInstallState, getInstallState, getServerInstallState);
  // Hydration always renders with `state === 'none'` (the server snapshot),
  // so reading localStorage here can't change the hydrated markup.
  const [hidden, setHidden] = useState(() =>
    typeof window === 'undefined' ? false : isInstallCardSnoozed(),
  );
  const [busy, setBusy] = useState(false);

  if (state === 'none' || hidden) return null;

  function dismiss() {
    snoozeInstallCard();
    setHidden(true);
  }

  async function install() {
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  }

  const pitch = myRole
    ? `You're ${myRole} at the next meeting. Keep the agenda and your role one tap away.`
    : 'Open your agenda, role and progress in one tap, straight from your home screen.';

  return (
    <div className="rounded-xl border border-line bg-canvas p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <DeviceMobile size={16} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">
              {state === 'prompt'
                ? 'Install Toastie on this device'
                : 'Add Toastie to your Home Screen'}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">{pitch}</p>
            {state === 'ios' ? (
              <ol className="mt-2 flex flex-col gap-1 text-xs text-ink-soft">
                <li className="flex items-center gap-1.5">
                  1. Tap <Export size={14} weight="bold" aria-label="Share" className="text-ink" />{' '}
                  Share in the browser toolbar
                </li>
                <li className="flex items-center gap-1.5">
                  2. Choose <PlusSquare size={14} weight="bold" aria-hidden className="text-ink" />
                  <span className="font-medium text-ink">Add to Home Screen</span>
                </li>
              </ol>
            ) : null}
            {state === 'ios-in-app' ? (
              <p className="mt-2 text-xs text-ink-soft">
                This in-app browser cannot install apps. Open this page in{' '}
                <span className="font-medium text-ink">Safari</span>, then tap Share → Add to Home
                Screen.
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button type="text" size="small" onClick={dismiss}>
            Not now
          </Button>
          {state === 'prompt' ? (
            <Button type="primary" size="small" loading={busy} onClick={install}>
              Install
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
