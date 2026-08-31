import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import toastieLogo from '../../../../assets/toastie.svg';

/** Shell for the public policy pages — the privacy policy and the account
 * deletion request page.
 *
 * A route group, so these live at `/privacy` and `/account-deletion` rather
 * than under a `/legal` prefix. Both URLs are submitted to Google Play (the
 * privacy policy in the store listing, the deletion page in the Data safety
 * form) and are checked by a reviewer, so they need to stay short, stable and
 * reachable without an account.
 *
 * Deliberately not `AuthShell`: that backdrop is for credential screens, and
 * a page someone reads to find out what happens to their data should read
 * like a document, not a landing page.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#1c1c1c]">
      <header className="border-b border-black/8">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
          <Link href="/" className="flex items-center gap-2 text-[#0b2a4c]">
            <Image src={toastieLogo} alt="" aria-hidden className="h-7 w-auto" priority />
            <span className="text-sm font-semibold tracking-wide">Toastie</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>

      <footer className="border-t border-black/8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-black/55">
          <span>© {new Date().getFullYear()} Nifty IT Solution</span>
          <Link href="/privacy" className="hover:text-[#0b2a4c]">
            Privacy policy
          </Link>
          <Link href="/account-deletion" className="hover:text-[#0b2a4c]">
            Delete your account
          </Link>
        </div>
      </footer>
    </div>
  );
}
