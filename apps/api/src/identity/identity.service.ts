import { Injectable } from '@nestjs/common';
import type { Person, Prisma } from '@prisma/client';

import { normalizePhone, PHONE_REGEX } from '@/common';
import { PrismaService } from '@/prisma';

/** Any Prisma entry point — a transaction client mid-`$transaction` or the
 * plain service — so callers can keep related writes atomic. */
export type IdentityDb = Prisma.TransactionClient | PrismaService;

/** Profile fields a club-sourced row (guest, roster entry) can contribute
 * to the shared person. All optional: only what the row actually carries
 * is ever considered. */
export interface PersonSource {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
  organization?: string | null;
  socials?: unknown;
}

function hasSocials(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/**
 * The single writer of the `Person` table — every path that records a phone
 * number (guest add, roster add, registration, profile save, invite accept,
 * join approval, club join) goes through here, so the merge policy from
 * docs/IDENTITY_PLAN.md §5 lives in exactly one place:
 *
 * - `ensurePerson` — club-sourced rows: find-or-create, filling only
 *   still-empty fields. A club never overwrites what another club (or the
 *   account holder) already contributed.
 * - `claimPerson` — registration/provisioning: the number gains an owner;
 *   names become canonical immediately, other fields stay fill-empty until
 *   the holder actually saves a profile.
 * - `syncUserProfile` — the account holder's save: verbatim and
 *   authoritative everywhere, including cleared fields.
 */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normalise for identity use. Null means "no usable phone" — the row
   * stays club-local (a name-only guest is valid data, just not global). */
  normalize(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const normalized = normalizePhone(phone);
    return PHONE_REGEX.test(normalized) ? normalized : null;
  }

  async findByPhone(
    phone: string | null | undefined,
    db: IdentityDb = this.prisma,
  ): Promise<Person | null> {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    return db.person.findUnique({ where: { phone: normalized } });
  }

  /** Find-or-create the person behind a phone, filling still-empty fields
   * from the club-sourced row being written. Never overwrites non-empty. */
  async ensurePerson(
    phone: string | null | undefined,
    source: PersonSource,
    db: IdentityDb = this.prisma,
  ): Promise<Person | null> {
    const normalized = this.normalize(phone);
    if (!normalized) return null;
    const existing = await db.person.findUnique({ where: { phone: normalized } });
    if (!existing) {
      return db.person.create({
        data: {
          phone: normalized,
          firstName: source.firstName?.trim() ?? '',
          lastName: source.lastName?.trim() ?? '',
          email: source.email?.trim() || null,
          bio: source.bio ?? null,
          avatarUrl: source.avatarUrl || null,
          whatsapp: source.whatsapp ?? null,
          organization: source.organization ?? null,
          socials: hasSocials(source.socials) ? (source.socials as Prisma.InputJsonValue) : [],
        },
      });
    }
    const fill: Prisma.PersonUpdateInput = {};
    if (!existing.firstName && source.firstName?.trim()) fill.firstName = source.firstName.trim();
    if (!existing.lastName && source.lastName?.trim()) fill.lastName = source.lastName.trim();
    if (!existing.email && source.email?.trim()) fill.email = source.email.trim();
    if (!existing.bio && source.bio) fill.bio = source.bio;
    if (!existing.avatarUrl && source.avatarUrl) fill.avatarUrl = source.avatarUrl;
    if (!existing.whatsapp && source.whatsapp) fill.whatsapp = source.whatsapp;
    if (!existing.organization && source.organization) fill.organization = source.organization;
    if (!hasSocials(existing.socials) && hasSocials(source.socials)) {
      fill.socials = source.socials as Prisma.InputJsonValue;
    }
    if (Object.keys(fill).length === 0) return existing;
    return db.person.update({ where: { id: existing.id }, data: fill });
  }

  /**
   * Registration / account provisioning: claim the person behind the
   * account's phone. Names become canonical immediately (the SIM-recycling
   * mitigation from the plan: history displays under the holder's name);
   * other fields stay fill-empty until the holder saves a profile. Rows
   * keyed by this number that never got linked (pre-Person stragglers) are
   * linked here, so claiming remains "nothing moves, everything attaches".
   */
  async claimPerson(userId: string, db: IdentityDb = this.prisma): Promise<Person | null> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const phone = this.normalize(user.phone);

    // The number changed since the last claim — release the old person back
    // to being an unclaimed club contact before claiming the new one.
    await db.person.updateMany({
      where: { userId, ...(phone ? { NOT: { phone } } : {}) },
      data: { userId: null },
    });
    if (!phone) return null;

    const found = await this.ensurePerson(phone, user, db);
    if (!found) return null;
    const person = await db.person.update({
      where: { id: found.id },
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        ...(found.userId === userId
          ? {}
          : { user: { connect: { id: userId } }, claimedAt: found.claimedAt ?? new Date() }),
      },
    });

    await db.prospect.updateMany({
      where: { phone, personId: null },
      data: { personId: person.id },
    });
    await db.membership.updateMany({
      where: { phone, personId: null },
      data: { personId: person.id },
    });
    return person;
  }

  /**
   * Phase 2 write-through: a club edited shared fields on one of its rows
   * (guest or roster entry). Last non-empty write wins among clubs — but
   * only while the person is unclaimed. Once an account owns the number its
   * profile is authoritative and club edits stop propagating
   * (IDENTITY_PLAN §5). Clearing a field does not erase shared data.
   */
  async applyClubSource(
    personId: string,
    source: PersonSource,
    db: IdentityDb = this.prisma,
  ): Promise<void> {
    const person = await db.person.findUnique({ where: { id: personId } });
    if (!person || person.userId) return;
    const data: Prisma.PersonUpdateInput = {};
    if (source.firstName?.trim()) data.firstName = source.firstName.trim();
    if (source.lastName?.trim()) data.lastName = source.lastName.trim();
    if (source.email?.trim()) data.email = source.email.trim();
    if (source.bio) data.bio = source.bio;
    if (source.avatarUrl) data.avatarUrl = source.avatarUrl;
    if (source.whatsapp) data.whatsapp = source.whatsapp;
    if (source.organization) data.organization = source.organization;
    if (hasSocials(source.socials)) data.socials = source.socials as Prisma.InputJsonValue;
    if (Object.keys(data).length === 0) return;
    await db.person.update({ where: { id: personId }, data });
  }

  /**
   * Authoritative sync after a profile save (self-service or Super Admin
   * edit). Whatever the account holds after the edit is what every club,
   * roster and guest list sees — including cleared fields, since the holder
   * is the source of truth. Reconciles the person link on a number change.
   */
  async syncUserProfile(userId: string, db: IdentityDb = this.prisma): Promise<Person | null> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const phone = this.normalize(user.phone);
    await db.person.updateMany({
      where: { userId, ...(phone ? { NOT: { phone } } : {}) },
      data: { userId: null },
    });
    if (!phone) return null;

    const profile = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      socials: user.socials as Prisma.InputJsonValue,
    };
    const existing = await db.person.findUnique({ where: { phone } });
    if (!existing) {
      return db.person.create({
        data: { phone, ...profile, user: { connect: { id: userId } }, claimedAt: new Date() },
      });
    }
    return db.person.update({
      where: { id: existing.id },
      data: {
        ...profile,
        user: { connect: { id: userId } },
        claimedAt: existing.claimedAt ?? new Date(),
      },
    });
  }
}
