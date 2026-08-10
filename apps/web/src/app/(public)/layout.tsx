import { PageTransition } from '@/components/page-transition';

/** Unauthenticated shell — sign-in, register, public share pages and the
 * onboarding screen live here. Deliberately empty: no sidebar, no header,
 * no session provider. Public share pages that need a minimum session shape
 * (e.g. evaluator name lookup) still work — they read their data through
 * dedicated unauthenticated endpoints in S13. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
