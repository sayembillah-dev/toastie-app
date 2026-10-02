/** Chromium's install-prompt event. Not in lib.dom.d.ts — it's a
 * non-standard API that only Chrome, Edge, Samsung Internet and other
 * Chromium browsers fire. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    /** Stashed by the inline `INSTALL_CAPTURE_SCRIPT` in the root layout —
     * see that constant for why it can't wait for React. */
    __toastieInstallPrompt?: BeforeInstallPromptEvent | null;
  }
  interface Navigator {
    /** iOS Safari's pre-`display-mode` flag for home-screen launches. */
    standalone?: boolean;
  }
}

/** Chrome fires `beforeinstallprompt` once, whenever it decides the page is
 * installable — which can be before the JS bundle hydrates. A listener
 * attached in a `useEffect` would miss it, so this runs as an inline <head>
 * script during HTML parse and parks the event on `window`, then lets the
 * store below pick it up. `preventDefault()` suppresses Chrome's own
 * mini-infobar so the dashboard card is the one place the offer appears. */
export const INSTALL_CAPTURE_SCRIPT = `
window.__toastieInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__toastieInstallPrompt = e;
  window.dispatchEvent(new Event('toastie:installable'));
});
window.addEventListener('appinstalled', function () {
  window.__toastieInstallPrompt = null;
  window.dispatchEvent(new Event('toastie:installable'));
});
`;

/** What the install card should offer on this device:
 * - `prompt`: Chromium has a deferred install prompt we can trigger.
 * - `ios`: iOS Safari — no prompt API, so show Share → Add to Home Screen.
 * - `ios-in-app`: iOS inside Facebook/Instagram's in-app browser, which has
 *   no Add to Home Screen at all; the user has to open Safari first.
 * - `none`: already installed, not installable, or nothing to offer. */
export type InstallState = 'prompt' | 'ios' | 'ios-in-app' | 'none';

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Line\//.test(navigator.userAgent);
}

export function getInstallState(): InstallState {
  if (isStandalone()) return 'none';
  if (window.__toastieInstallPrompt) return 'prompt';
  if (isIos()) return isInAppBrowser() ? 'ios-in-app' : 'ios';
  return 'none';
}

/** Server render and hydration both see `none`, so the card never causes a
 * hydration mismatch — it appears on the first client re-render. */
export function getServerInstallState(): InstallState {
  return 'none';
}

export function subscribeInstallState(onChange: () => void): () => void {
  window.addEventListener('toastie:installable', onChange);
  return () => window.removeEventListener('toastie:installable', onChange);
}

/** Opens Chrome's real install dialog. The deferred event is single-use —
 * Chrome throws if `prompt()` is called twice — so it's cleared either way,
 * and Chrome will fire a fresh `beforeinstallprompt` later if the user
 * dismissed it and the page is still installable. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = window.__toastieInstallPrompt;
  if (!event) return 'unavailable';
  window.__toastieInstallPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  window.dispatchEvent(new Event('toastie:installable'));
  return outcome;
}

const DISMISSED_KEY = 'toastie:install-card-dismissed-at';
/** "Not now" hides the card for two weeks rather than forever — a member
 * who wasn't ready on day one may be by the time they hold a role. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export function isInstallCardSnoozed(now = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    return raw !== null && now - Number(raw) < SNOOZE_MS;
  } catch {
    // Private mode / blocked storage — just show the card.
    return false;
  }
}

export function snoozeInstallCard(now = Date.now()): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(now));
  } catch {
    // Best-effort; the card still hides for this session via component state.
  }
}
