import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject, scopeFilter } from '@toastly/access';

import { ClubLineageCache } from '@/access';
import { PrismaService } from '@/prisma';

import { type CreateAreaDto, type UpdateAreaDto } from './dto/areas.dto';
import { type AreaWire, toAreaWire } from './serializers';

@Injectable()
export class AreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineageCache: ClubLineageCache,
  ) {}

  async list(subject: PermissionSubject, divisionId?: string): Promise<AreaWire[]> {
    const filter = scopeFilter(subject, 'read', 'orgUnit');
    if (filter.kind === 'none') return [];

    const where: Prisma.AreaWhereInput = {};
    if (divisionId) where.divisionId = divisionId;

    if (filter.kind === 'orgUnits') {
      const or: Prisma.AreaWhereInput[] = [];
      if (filter.districtIds.length > 0) or.push({ districtId: { in: filter.districtIds } });
      if (filter.divisionIds.length > 0) or.push({ divisionId: { in: filter.divisionIds } });
      if (filter.areaIds.length > 0) or.push({ id: { in: filter.areaIds } });
      if (or.length === 0) return [];
      where.OR = or;
    } else if (filter.kind === 'clubs') {
      return [];
    }

    const rows = await this.prisma.area.findMany({ where, orderBy: { name: 'asc' } });
    return rows.map(toAreaWire);
  }

  async create(subject: PermissionSubject, dto: CreateAreaDto): Promise<AreaWire> {
    if (!can(subject, 'create', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'create',
        reason: 'Only Super Admin can create areas',
      });
    }
    const parent = await this.prisma.division.findUnique({
      where: { id: dto.divisionId },
      select: { id: true, districtId: true },
    });
    if (!parent) throw new NotFoundException(`No division with id "${dto.divisionId}"`);

    const row = await this.prisma.area.create({
      data: {
        name: dto.name.trim(),
        divisionId: parent.id,
        districtId: parent.districtId,
      },
    });
    return toAreaWire(row);
  }

  async update(subject: PermissionSubject, areaId: string, dto: UpdateAreaDto): Promise<AreaWire> {
    const existing = await this.prisma.area.findUnique({ where: { id: areaId } });
    if (!existing) throw new NotFoundException(`No area with id "${areaId}"`);

    if (
      !can(subject, 'update', 'orgUnit', {
        areaId: existing.id,
        divisionId: existing.divisionId,
        districtId: existing.districtId,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'update',
        reason: 'You do not manage this area',
      });
    }

    let destDivision: { id: string; districtId: string } | null = null;
    const moved = dto.divisionId !== undefined && dto.divisionId !== existing.divisionId;
    if (moved) {
      destDivision = await this.prisma.division.findUnique({
        where: { id: dto.divisionId },
        select: { id: true, districtId: true },
      });
      if (!destDivision) throw new NotFoundException(`No division with id "${dto.divisionId}"`);
      if (
        !can(subject, 'update', 'orgUnit', {
          divisionId: destDivision.id,
          districtId: destDivision.districtId,
        })
      ) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          resource: 'orgUnit',
          action: 'update',
          reason: 'You do not manage the destination division',
        });
      }
    }

    const data: Prisma.AreaUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (destDivision) {
      data.division = { connect: { id: destDivision.id } };
      data.districtId = destDivision.districtId;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const area = await tx.area.update({ where: { id: areaId }, data });
      if (destDivision) {
        // Push the new lineage onto every child club so `Club.divisionId`
        // and `Club.districtId` never lag behind their parent Area.
        await tx.club.updateMany({
          where: { areaId: area.id },
          data: { divisionId: area.divisionId, districtId: area.districtId },
        });
      }
      return area;
    });

    if (destDivision) this.lineageCache.invalidate();

    return toAreaWire(updated);
  }

  async delete(subject: PermissionSubject, areaId: string): Promise<void> {
    if (!can(subject, 'delete', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'delete',
        reason: 'Only Super Admin can delete areas',
      });
    }
    const existing = await this.prisma.area.findUnique({
      where: { id: areaId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No area with id "${areaId}"`);

    await this.prisma.$transaction([
      this.prisma.club.deleteMany({ where: { areaId } }),
      this.prisma.area.delete({ where: { id: areaId } }),
    ]);
    this.lineageCache.invalidate();
  }
}
