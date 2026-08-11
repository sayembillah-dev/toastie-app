'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AppShell } from '@/components/app-shell';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useAppSelector } from '@/store/hooks';
import {
  defaultRouteForContext,
  selectActiveContextKey,
  selectSessionMemberships,
  selectSessionOrgAssignments,
  selectSessionStatus,
  selectSessionUser,
} from '@/store/session-slice';
import { unitKeyForContext } from '@/store/ui-slice';

/** Client-side dispatcher between the authenticated shell, the onboarding
 * screen, and the login redirect. The `(app)` layout is a server
 * component and can't read the session — this component runs inside
 * `SessionProvider`, sees the status, and picks which frame the page
 * renders inside.
 *
 * Zero memberships + zero org assignments + not super admin → onboarding.
 * `status === 'unauthenticated'` → redirect to `/login`. Anything else →
 * the shell. While `status === 'idle'` the shell renders a suspended
 * frame so nothing flashes for a paint.
 *
 * `/` (`DashboardPage`) only has a built surface for a club context —
 * `login/page.tsx` and `register/page.tsx` always `router.replace('/')`
 * regardless of the caller's actual context, so a Super Admin or
 * Director landed on a page that renders nothing. Redirect them to
 * their scope's real dashboard the same way `UnitSwitcher` would. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const status = useAppSelector(selectSessionStatus);
  const user = useAppSelector(selectSessionUser);
  const memberships = useAppSelector(selectSessionMemberships);
  const orgAssignments = useAppSelector(selectSessionOrgAssignments);
  const contextKey = useAppSelector(selectActiveContextKey);
  const router = useRouter();
  const pathname = usePathname();

  const isOnboarding =
    status === 'ready' &&
    memberships.length === 0 &&
    orgAssignments.length === 0 &&
    !user?.isSuperAdmin;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  /* Onboarding users hold no context at all — `contextKey` is `null` (the
   * backend has nowhere else to send a user with zero memberships and zero
   * org assignments) — so `unitKeyForContext` already resolves to `null`
   * and this effect no-ops. The `isOnboarding` guard just short-circuits
   * that explicitly rather than relying on it. */
  useEffect(() => {
    if (status !== 'ready' || pathname !== '/' || isOnboarding) return;
    const unit = unitKeyForContext(contextKey);
    if (unit && unit !== 'club') {
      router.replace(defaultRouteForContext(contextKey));
    }
  }, [status, pathname, contextKey, router, isOnboarding]);

  if (status === 'unauthenticated') {
    return null;
  }

  if (isOnboarding) return <OnboardingScreen />;
  return <AppShell>{children}</AppShell>;
}
