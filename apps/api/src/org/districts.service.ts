import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject, scopeFilter } from '@toastly/access';

import { PrismaService } from '@/prisma';

import { type CreateDistrictDto, type UpdateDistrictDto } from './dto/districts.dto';
import { type DistrictWire, toDistrictWire } from './serializers';

/** Directors do not have `orgUnit:create`/`orgUnit:delete` — only Super Admin
 * (the global bypass) can add or remove districts. `orgUnit:update` is what
 * lets a District Director rename their own district; the fine-grained check
 * inside `update`/`delete` catches an attempt to touch another district
 * through the coarse-guard's context header. */
@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(subject: PermissionSubject): Promise<DistrictWire[]> {
    const filter = scopeFilter(subject, 'read', 'orgUnit');
    if (filter.kind === 'none') return [];
    const where = whereFromScope(filter);
    const rows = await this.prisma.district.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows.map(toDistrictWire);
  }

  async create(subject: PermissionSubject, dto: CreateDistrictDto): Promise<DistrictWire> {
    if (!can(subject, 'create', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'create',
        reason: 'Only Super Admin can create districts',
      });
    }
    const row = await this.prisma.district.create({
      data: { name: dto.name.trim(), code: dto.code.trim() },
    });
    return toDistrictWire(row);
  }

  async update(
    subject: PermissionSubject,
    districtId: string,
    dto: UpdateDistrictDto,
  ): Promise<DistrictWire> {
    const existing = await this.prisma.district.findUnique({ where: { id: districtId } });
    if (!existing) throw new NotFoundException(`No district with id "${districtId}"`);

    // Fine check against the resource's actual anchor — the coarse
    // `PermissionGuard` only verified permission in the caller's context.
    if (!can(subject, 'update', 'orgUnit', { districtId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'update',
        reason: 'You do not manage this district',
      });
    }

    const data: Prisma.DistrictUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim();

    const row = await this.prisma.district.update({ where: { id: districtId }, data });
    return toDistrictWire(row);
  }

  async delete(subject: PermissionSubject, districtId: string): Promise<void> {
    if (!can(subject, 'delete', 'orgUnit')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgUnit',
        action: 'delete',
        reason: 'Only Super Admin can delete districts',
      });
    }
    const existing = await this.prisma.district.findUnique({
      where: { id: districtId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`No district with id "${districtId}"`);

    // Cascade is expressed at the schema level (`onDelete: Restrict` on
    // Division), so we have to unwind the tree ourselves. Order matters:
    // clubs → areas → divisions → the district itself. Wrapped in a tx so a
    // partial delete never leaves orphans.
    await this.prisma.$transaction([
      this.prisma.club.deleteMany({ where: { districtId } }),
      this.prisma.area.deleteMany({ where: { districtId } }),
      this.prisma.division.deleteMany({ where: { districtId } }),
      this.prisma.district.delete({ where: { id: districtId } }),
    ]);
  }
}

function whereFromScope(
  filter: ReturnType<typeof scopeFilter>,
): Prisma.DistrictWhereInput | undefined {
  if (filter.kind === 'global') return undefined;
  if (filter.kind === 'none') return { id: { in: [] } };
  if (filter.kind === 'clubs') return { id: { in: [] } };
  // `filter.kind === 'orgUnits'` — a Division/Area Director's assignments
  // do not put ids in `districtIds`, so those callers see an empty list.
  // That is the intended read behaviour for scoped grants.
  return { id: { in: [...new Set<string>(filter.districtIds)] } };
}
