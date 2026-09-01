'use client';

import { App } from 'antd';
import { useRouter } from 'next/navigation';

import { clearAuthStorage, readRefreshToken } from '@/lib/auth/token-storage';
import { toastlyApi, useAuthLogoutMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { sessionUnauthenticated } from '@/store/session-slice';

/** Shared sign-out, used by the app shell's rail and the onboarding screen
 * (which renders without the shell). Best-effort server-side revoke (kills
 * this refresh token's family), then unconditionally clear local state — a
 * failed revoke call must never leave the user stuck signed in on their own
 * machine. */
export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const [authLogout] = useAuthLogoutMutation();

  return async () => {
    const refreshToken = readRefreshToken();
    try {
      if (refreshToken) await authLogout({ refreshToken }).unwrap();
    } catch {
      // Ignore — the token may already be expired/revoked server-side.
    } finally {
      clearAuthStorage();
      dispatch(toastlyApi.util.resetApiState());
      dispatch(sessionUnauthenticated());
      message.success('Signed out');
      router.replace('/login');
    }
  };
}
