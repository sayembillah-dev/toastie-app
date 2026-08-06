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
import { PrismaService } from '@/prisma';

import { type CreateOrgClubDto, type UpdateOrgClubDto } from './dto/clubs.dto';
import {
  type OrgClubWire,
  type PublicClubWire,
  toOrgClubWire,
  toPublicClubWire,
} from './serializers';

@Injectable()
export class ClubsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineageCache: ClubLineageCache,
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
      select: { id: true, slug: true, name: true, clubNumber: true },
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
    const trimmedNumber = dto.clubNumber?.trim() || undefined;

    try {
      const row = await this.prisma.club.create({
        data: {
          areaId: area.id,
          divisionId: area.divisionId,
          districtId: area.districtId,
          name: dto.name.trim(),
          slug,
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
}

function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'club';
}
