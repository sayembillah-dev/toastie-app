/// App-wide the UI collects a single "Full name" input; storage still uses
/// firstName/lastName columns. Split on the FIRST space: "Sayem Billah" →
/// (Sayem, Billah), "Md. Abu Sayed Khan" → (Md., Abu Sayed Khan). A single
/// word leaves lastName empty, which every consumer already tolerates.
export function splitFullName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

/// Shape every name-carrying DTO now has: the new single `name` input
/// alongside the legacy `firstName`/`lastName` pair, kept so older clients
/// (and the mobile app until its parity pass) keep working.
export interface NameFields {
  name?: string;
  firstName?: string;
  lastName?: string;
}

/** Create-path resolution: the effective name, with `name` winning when both
 * shapes are present. `undefined` when neither a usable `name` nor a
 * `firstName` was provided — the caller rejects with a 400. */
export function resolveNames(dto: NameFields): { firstName: string; lastName: string } | undefined {
  if (dto.name !== undefined) {
    const split = splitFullName(dto.name);
    return split.firstName === '' ? undefined : split;
  }
  if (dto.firstName === undefined) return undefined;
  const firstName = dto.firstName.trim();
  if (firstName === '') return undefined;
  return { firstName, lastName: dto.lastName?.trim() ?? '' };
}

/** Update-path resolution: which of firstName/lastName to write, given
 * either the single `name` input (sets both) or the legacy pair (sets
 * whichever is present, so a last-name-only edit keeps working). Keys absent
 * from the result stay untouched. DTO validation rejects a blank `name`
 * before this runs. */
export function resolveNamePatch(dto: NameFields): {
  firstName?: string;
  lastName?: string;
} {
  if (dto.name !== undefined) return splitFullName(dto.name);
  const patch: { firstName?: string; lastName?: string } = {};
  if (dto.firstName !== undefined) patch.firstName = dto.firstName.trim();
  if (dto.lastName !== undefined) patch.lastName = dto.lastName.trim();
  return patch;
}
