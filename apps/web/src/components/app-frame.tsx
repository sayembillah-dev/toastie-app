'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AppShell } from '@/components/app-shell';
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen';
import { useAppSelector } from '@/store/hooks';
import {
  selectSessionMemberships,
  selectSessionOrgAssignments,
  selectSessionStatus,
  selectSessionUser,
} from '@/store/session-slice';

/** Client-side dispatcher between the authenticated shell, the onboarding
 * screen, and the login redirect. The `(app)` layout is a server
 * component and can't read the session — this component runs inside
 * `SessionProvider`, sees the status, and picks which frame the page
 * renders inside.
 *
 * Zero memberships + zero org assignments + not super admin → onboarding.
 * `status === 'unauthenticated'` → redirect to `/login`. Anything else →
 * the shell. While `status === 'idle'` the shell renders a suspended
 * frame so nothing flashes for a paint. */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const status = useAppSelector(selectSessionStatus);
  const user = useAppSelector(selectSessionUser);
  const memberships = useAppSelector(selectSessionMemberships);
  const orgAssignments = useAppSelector(selectSessionOrgAssignments);
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'unauthenticated') {
    return null;
  }

  const isOnboarding =
    status === 'ready' &&
    memberships.length === 0 &&
    orgAssignments.length === 0 &&
    !user?.isSuperAdmin;

  if (isOnboarding) return <OnboardingScreen />;
  return <AppShell>{children}</AppShell>;
}
