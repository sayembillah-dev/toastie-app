import { AppFrame } from '@/components/app-frame';
import { SessionProvider } from '@/components/session-provider';

/** The authenticated shell — everything inside `(app)/` renders here.
 *
 * `SessionProvider` populates the session on mount; `AppFrame` reads that
 * state and picks between the sidebar/header shell and the onboarding
 * screen (zero memberships + no org role + not super admin).
 *
 * Route groups (parenthesised segments) don't affect the URL — `/meetings`
 * still lives at `/meetings`, this layout just applies to all pages inside
 * the `(app)` group. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppFrame>{children}</AppFrame>
    </SessionProvider>
  );
}
