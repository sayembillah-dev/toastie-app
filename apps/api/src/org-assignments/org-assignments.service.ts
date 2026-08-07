import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type OrgRole, type OrgUnitType, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import type { CreateOrgAssignmentDto } from './dto/org-assignments.dto';
import { type OrgAssignmentWire, toOrgAssignmentWire } from './serializers';

const UNIT_INCLUDE = {
  area: { select: { name: true } },
  division: { select: { name: true } },
  district: { select: { name: true } },
} satisfies Prisma.OrgAssignmentInclude;

/** `role` must match `unitType` — an `AreaDirector` assignment only makes
 * sense pointed at an Area. The Prisma model keeps them as separate
 * columns (typed FKs, not a polymorphic pointer), so nothing enforces this
 * pairing below the application layer. */
const ROLE_UNIT_TYPE: Record<OrgRole, OrgUnitType> = {
  AreaDirector: 'area',
  DivisionDirector: 'division',
  DistrictDirector: 'district',
};

/** Area/Division/District Director assignments — who directs which unit.
 * Only reachable via the Super Admin bypass (`orgAssignment` carries no
 * role grants anywhere), nested under `/users/:userId/org-assignments`
 * rather than its own top-level resource since assigning a Director is
 * always done from "editing this person," not from the org tree side. */
@Injectable()
export class OrgAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(subject: PermissionSubject, userId: string): Promise<OrgAssignmentWire[]> {
    if (!can(subject, 'read', 'orgAssignment')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgAssignment',
        action: 'read',
      });
    }
    const rows = await this.prisma.orgAssignment.findMany({
      where: { userId },
      include: UNIT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
    return rows.map(toOrgAssignmentWire);
  }

  async create(
    subject: PermissionSubject,
    userId: string,
    dto: CreateOrgAssignmentDto,
  ): Promise<OrgAssignmentWire> {
    if (!can(subject, 'create', 'orgAssignment')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgAssignment',
        action: 'create',
      });
    }
    if (ROLE_UNIT_TYPE[dto.role] !== dto.unitType) {
      throw new BadRequestException({
        code: 'ROLE_UNIT_MISMATCH',
        message: `${dto.role} must be assigned to a ${ROLE_UNIT_TYPE[dto.role]}, not a ${dto.unitType}`,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException(`No user with id "${userId}"`);

    await this.assertUnitExists(dto.unitType, dto.unitId);

    try {
      const row = await this.prisma.orgAssignment.create({
        data: {
          userId,
          role: dto.role,
          unitType: dto.unitType,
          areaId: dto.unitType === 'area' ? dto.unitId : null,
          divisionId: dto.unitType === 'division' ? dto.unitId : null,
          districtId: dto.unitType === 'district' ? dto.unitId : null,
        },
        include: UNIT_INCLUDE,
      });
      return toOrgAssignmentWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'ALREADY_ASSIGNED' });
      }
      throw err;
    }
  }

  async delete(subject: PermissionSubject, userId: string, assignmentId: string): Promise<void> {
    if (!can(subject, 'delete', 'orgAssignment')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'orgAssignment',
        action: 'delete',
      });
    }
    const row = await this.prisma.orgAssignment.findUnique({ where: { id: assignmentId } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException(`No org assignment with id "${assignmentId}" for this user`);
    }
    await this.prisma.orgAssignment.delete({ where: { id: assignmentId } });
  }

  private async assertUnitExists(unitType: OrgUnitType, unitId: string): Promise<void> {
    const exists =
      unitType === 'area'
        ? await this.prisma.area.findUnique({ where: { id: unitId }, select: { id: true } })
        : unitType === 'division'
          ? await this.prisma.division.findUnique({ where: { id: unitId }, select: { id: true } })
          : await this.prisma.district.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`No ${unitType} with id "${unitId}"`);
  }
}
