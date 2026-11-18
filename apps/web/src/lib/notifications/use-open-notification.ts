'use client';

import type { ActiveContextKey } from '@toastly/access';
import { App } from 'antd';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { writeStoredContext } from '@/lib/auth/token-storage';
import { toastlyApi, useMarkNotificationReadMutation } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  contextChanged,
  selectActiveContextKey,
  selectSessionMemberships,
} from '@/store/session-slice';

import type { AppNotification } from './notifications';

/** Opening a notification: mark it read, switch to its club when that isn't
 * the active one (the same three steps `UnitSwitcher` takes), then go to its
 * link. A club the user has since left can't be opened — they're told so
 * instead of landing on a 403. */
export function useOpenNotification() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const contextKey = useAppSelector(selectActiveContextKey);
  const memberships = useAppSelector(selectSessionMemberships);
  const [markRead] = useMarkNotificationReadMutation();

  return useCallback(
    async (notification: AppNotification) => {
      const targetKey: ActiveContextKey | null = notification.clubId
        ? `club:${notification.clubId}`
        : null;
      const switching = targetKey !== null && targetKey !== contextKey;

      if (switching && !memberships.some((m) => m.clubId === notification.clubId)) {
        if (!notification.read) void markRead(notification.id);
        message.info(
          `You're no longer a member of ${notification.clubName ?? 'that club'}, so this can't be opened.`,
        );
        return;
      }

      if (!notification.read) {
        const pending = markRead(notification.id);
        /* A club switch resets the whole API cache; let the read land first
         * so the refetched badge doesn't count it again. */
        if (switching) await pending;
      }

      if (switching && targetKey) {
        dispatch(contextChanged(targetKey));
        writeStoredContext(targetKey);
        dispatch(toastlyApi.util.resetApiState());
      }
      if (notification.link) router.push(notification.link);
    },
    [contextKey, memberships, markRead, dispatch, router, message],
  );
}
