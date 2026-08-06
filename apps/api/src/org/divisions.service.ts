import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject, scopeFilter } from '@toastly/access';

import { ClubLineageCache } from '@/access';
import { PrismaService } from '@/prisma';

import { type CreateDivisionDto, type UpdateDivisionDto } from './dto/divisions.dto';
import { type DivisionWire, toDivisionWire } from './serializers';

@Injectable()
export class DivisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineageCache: ClubLineageCache,
  ) {}

  async list(subject: PermissionSubject, districtId?: string): Promise<DivisionWire[]> {
    const filter = scopeFilter(subject, 'read', 'orgUnit');
    if (filter.kind === 'none') return [];

    const where: Prisma.DivisionWhereInput = {};
    if (districtId) where.districtId = districtId;

    if (filter.kind === 'orgUnits') {
      const or: Prisma.DivisionWhereInput[] = [];
      if (filter.districtIds.length > 0) or.push({ districtId: { in: filter.districtIds } });
      if (filter.divisionIds.length > 0) or.push({ id: { in: filter.divisionIds } });
      // An Area Director can update their own area (`orgUnit:update@area`)
      // but cannot see sibling divisions — the `read` scope filter above
      // already accounts for that. Only add the OR when we have anchors.
      if (or.length === 0) return [];
      where.OR = or;
    } else if (filter.kind === 'clubs') {
      return [];
    }

    const rows = await this.prisma.division.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map(toDivisionWire);
  }

  async create(subject: PermissionSubject, dto: CreateDivisionDto): Promise<DivisionWire> {
    if (!can(subject, 'create', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'create',
        reason: 'Only Super Admin can create divisions',
      });
    }
    const parent = await this.prisma.district.findUnique({
      where: { id: dto.districtId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException(`No district with id "${dto.districtId}"`);

    const row = await this.prisma.division.create({
      data: { name: dto.name.trim(), districtId: dto.districtId },
    });
    return toDivisionWire(row);
  }

  async update(
    subject: PermissionSubject,
    divisionId: string,
    dto: UpdateDivisionDto,
  ): Promise<DivisionWire> {
    const existing = await this.prisma.division.findUnique({ where: { id: divisionId } });
    if (!existing) throw new NotFoundException(`No division with id "${divisionId}"`);

    if (
      !can(subject, 'update', 'orgUnit', {
        divisionId: existing.id,
        districtId: existing.districtId,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'update',
        reason: 'You do not manage this division',
      });
    }

    const moved = dto.districtId !== undefined && dto.districtId !== existing.districtId;
    if (moved) {
      const dest = await this.prisma.district.findUnique({
        where: { id: dto.districtId },
        select: { id: true },
      });
      if (!dest) throw new NotFoundException(`No district with id "${dto.districtId}"`);
      // Require permission on the destination too — otherwise a caller who
      // could update their branch could push it into a branch they do not
      // manage. The reparent transaction below then rewrites `districtId`
      // on every downstream area and club.
      if (!can(subject, 'update', 'orgUnit', { districtId: dto.districtId })) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          resource: 'orgUnit',
          action: 'update',
          reason: 'You do not manage the destination district',
        });
      }
    }

    const data: Prisma.DivisionUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.districtId !== undefined) {
      data.district = { connect: { id: dto.districtId } };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const div = await tx.division.update({ where: { id: divisionId }, data });
      if (moved) {
        // Rewrite denormalised lineage on every Area/Club beneath this
        // division so scope resolution stays one indexed scan (per §1.3).
        await tx.area.updateMany({
          where: { divisionId: div.id },
          data: { districtId: div.districtId },
        });
        await tx.club.updateMany({
          where: { divisionId: div.id },
          data: { districtId: div.districtId },
        });
      }
      return div;
    });

    if (moved) {
      // Cheap belt-and-braces: any cached lineage answer for a club under
      // this division is now wrong. The 60s TTL would eventually clear it
      // anyway, but clearing eagerly lets a director see the move on the
      // next request instead of paging refresh for a minute.
      this.lineageCache.invalidate();
    }

    return toDivisionWire(updated);
  }

  async delete(subject: PermissionSubject, divisionId: string): Promise<void> {
    if (!can(subject, 'delete', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'delete',
        reason: 'Only Super Admin can delete divisions',
      });
    }
    const existing = await this.prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No division with id "${divisionId}"`);

    await this.prisma.$transaction([
      this.prisma.club.deleteMany({ where: { divisionId } }),
      this.prisma.area.deleteMany({ where: { divisionId } }),
      this.prisma.division.delete({ where: { id: divisionId } }),
    ]);
    this.lineageCache.invalidate();
  }
}
