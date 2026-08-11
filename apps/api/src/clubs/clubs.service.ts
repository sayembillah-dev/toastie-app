import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject, scopeFilter } from '@toastly/access';

import { ClubLineageCache } from '@/access';
import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import {
  type CreateOrgClubDto,
  type UpdateClubProfileDto,
  type UpdateOrgClubDto,
} from './dto/clubs.dto';
import {
  type ClubProfileWire,
  type OrgClubWire,
  type PublicClubWire,
  toClubProfileWire,
  toOrgClubWire,
  toPublicClubWire,
} from './serializers';

/** Reused by `getProfile`/`updateProfile` so both return the identical
 * shape `toClubProfileWire` expects, lineage names included. */
const CLUB_PROFILE_SELECT = {
  id: true,
  name: true,
  clubNumber: true,
  motto: true,
  venueAddress: true,
  venueMapUrl: true,
  contactPhone: true,
  socials: true,
  updatedAt: true,
  area: {
    select: {
      name: true,
      division: { select: { name: true, district: { select: { name: true } } } },
    },
  },
} satisfies Prisma.ClubSelect;

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineageCache: ClubLineageCache,
    private readonly activity: ActivityService,
  ) {}

  /** Directory list, scoped to the caller's `club:read` reach. Unplaced
   * clubs (no `areaId`) are excluded — they exist for self-registration in
   * S10 and shouldn't surface in a director's list. */
  async list(subject: PermissionSubject, areaId?: string): Promise<OrgClubWire[]> {
    const filter = scopeFilter(subject, 'read', 'club');
    if (filter.kind === 'none') return [];

    const where: Prisma.ClubWhereInput = { areaId: { not: null } };
    if (areaId) where.areaId = areaId;

    if (filter.kind === 'clubs') {
      where.id = { in: filter.clubIds };
    } else if (filter.kind === 'orgUnits') {
      const or: Prisma.ClubWhereInput[] = [];
      if (filter.districtIds.length > 0) or.push({ districtId: { in: filter.districtIds } });
      if (filter.divisionIds.length > 0) or.push({ divisionId: { in: filter.divisionIds } });
      if (filter.areaIds.length > 0) or.push({ areaId: { in: filter.areaIds } });
      if (or.length === 0) return [];
      where.OR = or;
    }

    const rows = await this.prisma.club.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map(toOrgClubWire);
  }

  /** Public — served on `GET /clubs/directory`. Anyone can list active
   * clubs for self-registration; a suspended or low-membership club is
   * hidden from the public browse but still visible to directors. */
  async directory(): Promise<PublicClubWire[]> {
    const rows = await this.prisma.club.findMany({
      where: { directoryStatus: 'active', lifecycle: 'active' },
      select: {
        id: true,
        slug: true,
        name: true,
        clubNumber: true,
        area: {
          select: {
            name: true,
            division: { select: { name: true, district: { select: { name: true } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(toPublicClubWire);
  }

  async create(subject: PermissionSubject, dto: CreateOrgClubDto): Promise<OrgClubWire> {
    if (!can(subject, 'create', 'club')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'club',
        action: 'create',
        reason: 'Only Super Admin can create clubs',
      });
    }
    const area = await this.prisma.area.findUnique({
      where: { id: dto.areaId },
      select: { id: true, divisionId: true, districtId: true },
    });
    if (!area) throw new NotFoundException(`No area with id "${dto.areaId}"`);

    const slug = await this.uniqueSlug(dto.name.trim());
    const joinCode = await this.uniqueJoinCode();
    const trimmedNumber = dto.clubNumber?.trim() || undefined;

    try {
      const row = await this.prisma.club.create({
        data: {
          areaId: area.id,
          divisionId: area.divisionId,
          districtId: area.districtId,
          name: dto.name.trim(),
          slug,
          joinCode,
          clubNumber: trimmedNumber,
          directoryStatus: dto.status ?? 'active',
          lifecycle: 'active',
          joinPolicy: 'request',
        },
      });
      return toOrgClubWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'CLUB_NUMBER_TAKEN',
          message: 'That club number is already in use',
        });
      }
      throw err;
    }
  }

  async update(
    subject: PermissionSubject,
    clubId: string,
    dto: UpdateOrgClubDto,
  ): Promise<OrgClubWire> {
    const existing = await this.prisma.club.findUnique({ where: { id: clubId } });
    if (!existing) throw new NotFoundException(`No club with id "${clubId}"`);
    if (!existing.areaId) {
      // Placement of an unclaimed self-registered club is a distinct flow
      // — deferred to S13. Reject here so the directory list doesn't need
      // to worry about half-updates on unplaced rows.
      throw new BadRequestException({
        code: 'CLUB_UNPLACED',
        message: 'This club has no area and cannot be edited from the directory',
      });
    }

    if (
      !can(subject, 'update', 'club', {
        clubId: existing.id,
        areaId: existing.areaId,
        divisionId: existing.divisionId ?? undefined,
        districtId: existing.districtId ?? undefined,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'club',
        action: 'update',
        reason: 'You do not manage this club',
      });
    }

    let destArea: { id: string; divisionId: string; districtId: string } | null = null;
    const moved = dto.areaId !== undefined && dto.areaId !== existing.areaId;
    if (moved) {
      destArea = await this.prisma.area.findUnique({
        where: { id: dto.areaId },
        select: { id: true, divisionId: true, districtId: true },
      });
      if (!destArea) throw new NotFoundException(`No area with id "${dto.areaId}"`);
      if (
        !can(subject, 'update', 'club', {
          areaId: destArea.id,
          divisionId: destArea.divisionId,
          districtId: destArea.districtId,
        })
      ) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          resource: 'club',
          action: 'update',
          reason: 'You do not manage the destination area',
        });
      }
    }

    const data: Prisma.ClubUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.status !== undefined) data.directoryStatus = dto.status;
    if ('clubNumber' in dto && dto.clubNumber !== undefined) {
      data.clubNumber = dto.clubNumber === null ? null : dto.clubNumber.trim() || null;
    }
    if (destArea) {
      data.area = { connect: { id: destArea.id } };
      data.divisionId = destArea.divisionId;
      data.districtId = destArea.districtId;
    }

    try {
      const updated = await this.prisma.club.update({ where: { id: clubId }, data });
      if (destArea) this.lineageCache.invalidate(clubId);
      return toOrgClubWire(updated);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'CLUB_NUMBER_TAKEN',
          message: 'That club number is already in use',
        });
      }
      throw err;
    }
  }

  async delete(subject: PermissionSubject, clubId: string): Promise<void> {
    if (!can(subject, 'delete', 'club')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'club',
        action: 'delete',
        reason: 'Only Super Admin can delete clubs',
      });
    }
    const existing = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No club with id "${clubId}"`);
    await this.prisma.club.delete({ where: { id: clubId } });
    this.lineageCache.invalidate(clubId);
  }

  /** Slug is `@unique` on `Club` — build it from the name and, if that's
   * taken, append a short random suffix. Not user-visible on create; the
   * directory can rename freely once a Club Admin exists. */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.club.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    if (!existing) return base;
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  /** Read by the Club Admin dashboard so the code can be copied and handed
   * to someone directly. Permission is enforced at the route (`club:update`)
   * against `ctx.clubId`, so no extra ownership check is needed here. */
  async getJoinCode(clubId: string): Promise<{ code: string }> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { joinCode: true },
    });
    if (!club) throw new NotFoundException(`No club with id "${clubId}"`);
    return { code: club.joinCode };
  }

  /** The clubless-onboarding counterpart to `InvitesService.acceptByToken` —
   * same "already a member?" guard and same `Membership` shape, but keyed
   * off the club's standing `joinCode` instead of a single-use invite token,
   * and always lands the caller as a plain `Member` (a code has no
   * admin-picked roles to carry, unlike an invite). */
  async joinByCode(userId: string, rawCode: string): Promise<{ clubId: string; clubName: string }> {
    const code = rawCode.trim().toUpperCase();
    const club = await this.prisma.club.findUnique({
      where: { joinCode: code },
      select: { id: true, name: true },
    });
    if (!club) {
      throw new NotFoundException({
        code: 'INVALID_CLUB_CODE',
        message: 'No club matches that code',
      });
    }

    const existingMembership = await this.prisma.membership.findFirst({
      where: { clubId: club.id, userId, status: 'active' },
      select: { id: true },
    });
    if (existingMembership) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this club',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException(`No user with id "${userId}"`);

    await this.prisma.membership.create({
      data: {
        clubId: club.id,
        userId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: ['Member'],
        isClubAdmin: false,
        status: 'active',
        grantOverrides: {},
      },
    });

    return { clubId: club.id, clubName: club.name };
  }

  /** Read by the Club Profile page — `GET /clubs/mine`. Permission is
   * enforced at the route (`club:update`) against `ctx.clubId`, same as
   * `getJoinCode`. */
  async getProfile(clubId: string): Promise<ClubProfileWire> {
    const row = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: CLUB_PROFILE_SELECT,
    });
    if (!row) throw new NotFoundException(`No club with id "${clubId}"`);
    return toClubProfileWire(row);
  }

  /** Write side of the Club Profile page — `PATCH /clubs/mine`. Unlike
   * `update()` (the director-facing `/org-clubs/:clubId` route), there's no
   * reparenting here and no `existing.areaId` requirement — a Club Admin
   * edits their own club's identity fields regardless of placement. */
  async updateProfile(
    clubId: string,
    actorMembershipId: string | null,
    dto: UpdateClubProfileDto,
  ): Promise<ClubProfileWire> {
    const existing = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No club with id "${clubId}"`);

    const data: Prisma.ClubUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if ('clubNumber' in dto && dto.clubNumber !== undefined) {
      data.clubNumber = dto.clubNumber === null ? null : dto.clubNumber.trim() || null;
    }
    if ('motto' in dto && dto.motto !== undefined) {
      data.motto = dto.motto === null ? null : dto.motto.trim() || null;
    }
    if ('venueAddress' in dto && dto.venueAddress !== undefined) {
      data.venueAddress = dto.venueAddress === null ? null : dto.venueAddress.trim() || null;
    }
    if ('venueMapUrl' in dto && dto.venueMapUrl !== undefined) {
      data.venueMapUrl = dto.venueMapUrl === null ? null : dto.venueMapUrl.trim() || null;
    }
    if ('contactPhone' in dto && dto.contactPhone !== undefined) {
      data.contactPhone = dto.contactPhone === null ? null : dto.contactPhone.trim() || null;
    }
    if (dto.socials !== undefined) {
      data.socials = dto.socials.map((social) => ({
        platform: social.platform,
        url: social.url.trim(),
      }));
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.club.update({
          where: { id: clubId },
          data,
          select: CLUB_PROFILE_SELECT,
        });
        await this.activity.record(
          {
            clubId,
            actorMembershipId,
            category: 'org',
            action: 'updated the club profile',
            summary: 'Updated the club profile',
            entityType: 'club',
            entityId: clubId,
          },
          tx,
        );
        return updated;
      });
      return toClubProfileWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'CLUB_NUMBER_TAKEN',
          message: 'That club number is already in use',
        });
      }
      throw err;
    }
  }

  private readonly joinCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  /** `joinCode` is `@unique` on `Club` — regenerate on the rare collision
   * rather than suffixing (unlike `uniqueSlug`, a code has no readable base
   * to suffix onto). */
  private async uniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = this.randomJoinCode();
      const existing = await this.prisma.club.findUnique({
        where: { joinCode: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    throw new Error('Could not generate a unique club join code');
  }

  /** 8 characters from an alphabet with the easily-confused ones (0/O, 1/I/L)
   * removed — this gets read aloud and typed by hand. */
  private randomJoinCode(): string {
    let out = '';
    for (let i = 0; i < 8; i++) {
      out += this.joinCodeAlphabet[Math.floor(Math.random() * this.joinCodeAlphabet.length)];
    }
    return out;
  }
}

function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'club';
}
