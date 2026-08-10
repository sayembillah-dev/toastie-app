'use client';

import { Bell } from '@phosphor-icons/react/dist/ssr';
import { App, Switch } from 'antd';
import { useEffect, useState } from 'react';

import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push/push-notifications';
import { useSubscribeToPushMutation, useUnsubscribeFromPushMutation } from '@/store/api';
import { getApiErrorMessage } from '@/store/api-error';

const VAPID_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

/** Self-service push opt-in — same card style as the rest of the profile
 * page. Sending isn't wired to any feature yet (see `PushService.send()` on
 * the API side), so this only builds the subscription pipeline: browser
 * permission, service worker registration, and the row in
 * `PushSubscription` a future notification can target. Disabled with an
 * explanatory note until `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set — see
 * .env.example. */
export function PushNotificationToggle() {
  const { message } = App.useApp();
  // Pure, synchronous browser feature check — safe as a lazy initializer
  // rather than an effect, since it never changes after mount.
  const [supported] = useState(isPushSupported);
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subscribeToPushApi] = useSubscribeToPushMutation();
  const [unsubscribeFromPushApi] = useUnsubscribeFromPushMutation();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getExistingPushSubscription()
      .then((sub) => setSubscribed(sub !== null))
      .finally(() => setChecking(false));
  }, []);

  async function handleChange(checked: boolean) {
    setBusy(true);
    try {
      if (checked) {
        const sub = await subscribeToPush();
        await subscribeToPushApi({ ...sub, userAgent: navigator.userAgent }).unwrap();
        setSubscribed(true);
      } else {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await unsubscribeFromPushApi({ endpoint }).unwrap();
        setSubscribed(false);
      }
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const disabled = !supported || !VAPID_CONFIGURED || checking || busy;

  return (
    <div className="mt-4 rounded-xl border border-line bg-canvas p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-ink-soft"
          >
            <Bell size={16} weight="bold" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Push notifications</p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {!supported
                ? "This browser doesn't support push notifications."
                : !VAPID_CONFIGURED
                  ? 'Coming soon — not yet enabled for this club.'
                  : 'Get notified on this device for things that need your attention.'}
            </p>
          </div>
        </div>
        <Switch checked={subscribed} disabled={disabled} loading={busy} onChange={handleChange} />
      </div>
    </div>
  );
}
