/** Guards the `?next=` redirect target login/register/change-password chain
 * through. Only a same-origin relative path is safe — `//evil.com` parses as
 * a protocol-relative URL a browser will happily follow, so it's rejected
 * alongside anything that isn't a leading `/`. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}
