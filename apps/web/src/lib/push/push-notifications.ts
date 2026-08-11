/** Wire shape the API's `POST /push/subscribe` expects — a subset of the
 * browser's `PushSubscriptionJSON` (endpoint + the two keys; `expirationTime`
 * isn't persisted). Mirrors `apps/api/src/push`'s `SubscribePushDto`. */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Idempotent — safe to call from both the app-wide PWA bootstrap
 * (`PwaServiceWorker`) and `subscribeToPush()`; the browser reuses the
 * existing registration instead of creating a duplicate. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}

/** `null` when the browser already had no subscription — distinct from "not
 * supported", which callers should check via `isPushSupported()` first. */
export async function getExistingPushSubscription(): Promise<PushSubscriptionInput | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const sub = await registration?.pushManager.getSubscription();
  return sub ? (sub.toJSON() as PushSubscriptionInput) : null;
}

/** Registers the service worker (idempotent) and creates a push
 * subscription. Throws if the VAPID public key isn't configured yet — see
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in next.config.ts — or if the user denies
 * the browser permission prompt. */
export async function subscribeToPush(): Promise<PushSubscriptionInput> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured yet (missing VAPID public key)');
  }
  const registration = await registerServiceWorker();
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  return sub.toJSON() as PushSubscriptionInput;
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
