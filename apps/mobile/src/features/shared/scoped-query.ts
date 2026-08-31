/**
 * Query keys namespaced by the active context.
 *
 * Every cached response was fetched under one `X-Toastly-Context`. A member of
 * two clubs who switches between them must not be shown the first club's
 * meetings while the second club's request is in flight — that is a tenancy
 * boundary crossed in the cache rather than the database, and the schema-level
 * protections in docs/ERD.md section 1 do nothing about it. Putting the context in
 * the key makes the two caches separate by construction.
 */

import { contextKey, useSession } from '@/session';

export function useScopedKey(...parts: readonly unknown[]): unknown[] {
  const { activeContext } = useSession();
  return [contextKey(activeContext) ?? 'no-context', ...parts];
}
