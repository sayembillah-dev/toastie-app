'use client';

import { useEffect } from 'react';

import { readAccessToken, readStoredContext } from '@/lib/auth/token-storage';

import { type RoleKind, type RoleStateBackend, registerRoleStateBackend } from './role-state';

/** Server backends for the live role modules' state (see `role-state.ts`).
 * Two variants mirror the two surfaces the modules render on:
 *
 * - `authedBackend` — the in-app tab. Sends the JWT + active context header
 *   exactly like `routed-base-query` does, hitting
 *   `PUT/GET /meetings/:id/role-state/:kind`.
 * - `publicBackend` — the anonymous share-link page. No session headers at
 *   all (a leaked link must work from a signed-out browser), hitting the
 *   share-token twin under `/public/meetings`.
 *
 * Both treat every failure as "stay silent": live capture must never break
 * because a sync call failed — the local copy keeps working and the next
 * mount retries hydration. */

function authedHeaders(): Headers {
  const headers = new Headers();
  const token = readAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const ctx = readStoredContext();
  if (ctx) headers.set('X-Toastly-Context', ctx);
  return headers;
}

function authedBackend(meetingId: string, kind: RoleKind): RoleStateBackend {
  const url = `/api/meetings/${meetingId}/role-state/${kind}`;
  return {
    async load() {
      const res = await fetch(url, { headers: authedHeaders() });
      if (!res.ok) return null;
      const body = (await res.json()) as { state?: unknown };
      return body.state ?? null;
    },
    save(state) {
      const headers = authedHeaders();
      headers.set('content-type', 'application/json');
      void fetch(url, { method: 'PUT', headers, body: JSON.stringify({ state }) }).catch(() => {});
    },
  };
}

function publicBackend(meetingId: string, kind: RoleKind, token: string): RoleStateBackend {
  const url = `/api/public/meetings/${meetingId}/role-state/${kind}?t=${encodeURIComponent(token)}`;
  return {
    async load() {
      const res = await fetch(url);
      if (!res.ok) return null;
      const body = (await res.json()) as { state?: unknown };
      return body.state ?? null;
    },
    save(state) {
      void fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      }).catch(() => {});
    },
  };
}

/** Wires a live role module to its server backend for the component's
 * lifetime: registers the backend, hydrates from the server on mount
 * (pushing any pre-sync local copy up), and mirrors every subsequent write
 * back. Pass the share token on the public page; omit it in the authed app. */
export function useRoleStateSync(kind: RoleKind, meetingId: string, shareToken?: string): void {
  useEffect(() => {
    if (!meetingId) return;
    const backend = shareToken
      ? publicBackend(meetingId, kind, shareToken)
      : authedBackend(meetingId, kind);
    return registerRoleStateBackend(kind, meetingId, backend);
  }, [kind, meetingId, shareToken]);
}
