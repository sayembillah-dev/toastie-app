/**
 * Creates the global `Person` rows for number-first identity and links every
 * existing `Prospect` / `Membership` to them (docs/IDENTITY_PLAN.md, Phase 0).
 *
 * Order matters — it encodes the merge policy (§5):
 *
 * 1. `User` rows first. The account holder is the authoritative source, so a
 *    claimed `Person` is seeded from the account's own profile and never has
 *    a non-empty field overwritten by a club-sourced row afterwards.
 * 2. `Prospect` rows (oldest first), then `Membership` rows. First non-empty
 *    value wins per field; later rows only fill fields still empty. Every
 *    processed row is linked (`personId`) whether or not it contributed data.
 *
 * Safe to run against a live app, and safe to run twice: rows already linked
 * are skipped, and field fills only ever write into NULL/empty columns, so a
 * second run is a no-op.
 *
 * Run with `pnpm --filter @toastly/api backfill:person`.
 */

import { Prisma, PrismaClient } from '@prisma/client';

import { normalizePhone } from '../src/common/phone';

const prisma = new PrismaClient();

type ProfileFields = {
  firstName: string;
  lastName: string;
  email?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
  organization?: string | null;
  socials?: Prisma.InputJsonValue | null;
};

function isEmptySocials(socials: unknown): boolean {
  return Array.isArray(socials) && socials.length === 0;
}

/** Fill only still-empty fields on an existing person. Returns the update. */
function fillPatch(
  person: Prisma.PersonGetPayload<object>,
  source: Partial<ProfileFields>,
): Prisma.PersonUpdateInput {
  const data: Prisma.PersonUpdateInput = {};
  if (!person.firstName && source.firstName) data.firstName = source.firstName;
  if (!person.lastName && source.lastName) data.lastName = source.lastName;
  if (!person.email && source.email) data.email = source.email;
  if (!person.bio && source.bio) data.bio = source.bio;
  if (!person.avatarUrl && source.avatarUrl) data.avatarUrl = source.avatarUrl;
  if (!person.whatsapp && source.whatsapp) data.whatsapp = source.whatsapp;
  if (!person.organization && source.organization) data.organization = source.organization;
  if (isEmptySocials(person.socials) && !isEmptySocials(source.socials ?? []))
    data.socials = source.socials as Prisma.InputJsonValue;
  return data;
}

/** Find or create the person for a phone, filling empty fields from source. */
async function ensurePerson(
  phone: string,
  source: Partial<ProfileFields> & { firstName: string; lastName: string },
): Promise<Prisma.PersonGetPayload<object>> {
  const existing = await prisma.person.findUnique({ where: { phone } });
  if (!existing) {
    return prisma.person.create({
      data: {
        phone,
        firstName: source.firstName,
        lastName: source.lastName,
        email: source.email ?? null,
        bio: source.bio ?? null,
        avatarUrl: source.avatarUrl ?? null,
        whatsapp: source.whatsapp ?? null,
        organization: source.organization ?? null,
        socials: (source.socials ?? []) as Prisma.InputJsonValue,
      },
    });
  }
  const patch = fillPatch(existing, source);
  if (Object.keys(patch).length === 0) return existing;
  return prisma.person.update({ where: { id: existing.id }, data: patch });
}

async function main() {
  const stats = {
    personsCreated: 0,
    usersLinked: 0,
    prospectsLinked: 0,
    membershipsLinked: 0,
    skippedBadPhone: 0,
  };

  // -- 1. Users: authoritative source, claims the number --------------------
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  for (const user of users) {
    const phone = normalizePhone(user.phone);
    if (!/^\d{11}$/.test(phone)) {
      console.warn(`skip user ${user.id}: phone "${user.phone}" not normalisable`);
      stats.skippedBadPhone += 1;
      continue;
    }
    const person = await ensurePerson(phone, user);
    const patch = fillPatch(person, user);
    await prisma.person.update({
      where: { id: person.id },
      data: {
        ...patch,
        ...(person.userId && person.userId !== user.id
          ? {} // already claimed by another user (duplicate phone) — leave it
          : { user: { connect: { id: user.id } }, claimedAt: person.claimedAt ?? user.createdAt }),
      },
    });
    stats.usersLinked += 1;
  }

  // -- 2. Prospects, oldest first: first non-empty value wins ---------------
  const prospects = await prisma.prospect.findMany({
    where: { phone: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  for (const prospect of prospects) {
    const phone = normalizePhone(prospect.phone!);
    if (!/^\d{11}$/.test(phone)) {
      console.warn(`skip prospect ${prospect.id}: phone "${prospect.phone}" not normalisable`);
      stats.skippedBadPhone += 1;
      continue;
    }
    const person = await ensurePerson(phone, prospect);
    if (prospect.personId !== person.id) {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { personId: person.id },
      });
      stats.prospectsLinked += 1;
    }
  }

  // -- 3. Memberships with a phone ------------------------------------------
  const memberships = await prisma.membership.findMany({
    where: { phone: { not: null } },
    orderBy: { createdAt: 'asc' },
  });
  for (const membership of memberships) {
    const phone = normalizePhone(membership.phone!);
    if (!/^\d{11}$/.test(phone)) {
      console.warn(
        `skip membership ${membership.id}: phone "${membership.phone}" not normalisable`,
      );
      stats.skippedBadPhone += 1;
      continue;
    }
    const person = await ensurePerson(phone, membership);
    if (membership.personId !== person.id) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { personId: person.id },
      });
      stats.membershipsLinked += 1;
    }
  }

  stats.personsCreated = await prisma.person.count();
  console.log('backfill complete:', stats);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
