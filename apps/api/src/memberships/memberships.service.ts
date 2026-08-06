import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, ClubRole as PrismaClubRole } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import type {
  CreateMemberDto,
  SetMemberAdminDto,
  SetMemberStatusDto,
  UpdateMemberDto,
} from './dto/members.dto';
import { toClubRoles } from './role-mapping';
import { type MemberWire, toMemberWire } from './serializers';

type OverridePatchValue = 'allow' | 'deny' | 'default';

const OVERRIDE_KEY = /^[a-zA-Z]+:[a-zA-Z]+$/;

/** Handles `/members` — the roster CRUD surface the Club Admin uses. Every
 * mutation runs the two-phase permission check (§2.5 of the plan): the coarse
 * `@Requires` guard checks the request's context, and the fine `can()` call
 * here checks the loaded row's own `clubId` so a caller can't PATCH a
 * membership in a club they don't hold. */
@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    subject: PermissionSubject,
    clubId: string,
    includeRemoved: boolean,
  ): Promise<MemberWire[]> {
    if (!can(subject, 'read', 'member', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.membership.findMany({
      where: {
        clubId,
        ...(includeRemoved ? {} : { status: 'active' }),
      },
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    });
    return rows.map(toMemberWire);
  }

  async get(subject: PermissionSubject, memberId: string): Promise<MemberWire> {
    const row = await this.prisma.membership.findUnique({ where: { id: memberId } });
    if (!row) throw new NotFoundException(`No member with id "${memberId}"`);
    if (!can(subject, 'read', 'member', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    return toMemberWire(row);
  }

  async create(
    subject: PermissionSubject,
    clubId: string,
    dto: CreateMemberDto,
  ): Promise<MemberWire> {
    if (!can(subject, 'create', 'member', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    const clubRoles = normaliseRoles(dto.roles);
    const row = await this.prisma.membership.create({
      data: {
        clubId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        roles: clubRoles,
        isClubAdmin: false,
        status: 'active',
        grantOverrides: {},
      },
    });
    return toMemberWire(row);
  }

  async update(
    subject: PermissionSubject,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberWire> {
    const existing = await this.load(memberId);
    this.assertUpdate(subject, existing, 'member', 'update');

    const data: Prisma.MembershipUpdateInput = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.roles !== undefined) {
      // Preserve the ClubAdmin marker if it's already there — `roles` is a
      // roster-role list and toggling admin lives on its own endpoint.
      const preserveAdmin = existing.roles.includes('ClubAdmin');
      const mapped = toClubRoles(dto.roles);
      data.roles = preserveAdmin ? [...mapped, 'ClubAdmin' as PrismaClubRole] : mapped;
    }

    const updated = await this.prisma.membership.update({ where: { id: memberId }, data });
    return toMemberWire(updated);
  }

  async setStatus(
    subject: PermissionSubject,
    memberId: string,
    dto: SetMemberStatusDto,
  ): Promise<MemberWire> {
    const existing = await this.load(memberId);
    this.assertUpdate(subject, existing, 'member', 'update');

    if (dto.status === 'removed' && (await this.wouldOrphanClubAdmin(existing))) {
      throw new BadRequestException({
        code: 'LAST_CLUB_ADMIN',
        message: 'The club must keep at least one active Club Admin — promote someone else first.',
      });
    }

    const updated = await this.prisma.membership.update({
      where: { id: memberId },
      data: { status: dto.status },
    });
    return toMemberWire(updated);
  }

  async setAdmin(
    subject: PermissionSubject,
    memberId: string,
    dto: SetMemberAdminDto,
  ): Promise<MemberWire> {
    const existing = await this.load(memberId);
    this.assertUpdate(subject, existing, 'memberRole', 'update');

    if (!dto.isClubAdmin && (await this.wouldOrphanClubAdmin(existing))) {
      throw new BadRequestException({
        code: 'LAST_CLUB_ADMIN',
        message:
          'The club must keep at least one Club Admin — promote someone else before revoking the last one.',
      });
    }

    // Keep `isClubAdmin` and the `ClubAdmin` roles-array marker aligned —
    // `SubjectFactory` reads the roles list to expand grants, so a divergence
    // would silently drop ClubAdmin permissions from `can()`.
    const rolesWithoutAdmin = existing.roles.filter((r) => r !== 'ClubAdmin');
    const nextRoles = dto.isClubAdmin
      ? [...rolesWithoutAdmin, 'ClubAdmin' as PrismaClubRole]
      : rolesWithoutAdmin;

    const updated = await this.prisma.membership.update({
      where: { id: memberId },
      data: { isClubAdmin: dto.isClubAdmin, roles: nextRoles },
    });
    return toMemberWire(updated);
  }

  async setPermissions(
    subject: PermissionSubject,
    memberId: string,
    body: unknown,
  ): Promise<MemberWire> {
    const patch = parsePermissionsPatch(body);
    const existing = await this.load(memberId);
    this.assertUpdate(subject, existing, 'memberPermission', 'update');

    const next: Record<string, 'allow' | 'deny'> = {
      ...currentOverrides(existing.grantOverrides),
    };
    for (const [key, value] of Object.entries(patch)) {
      if (value === 'default') delete next[key];
      else next[key] = value;
    }

    const updated = await this.prisma.membership.update({
      where: { id: memberId },
      data: { grantOverrides: next },
    });
    return toMemberWire(updated);
  }

  /** Loads a membership by id or throws a 404. Kept private because every
   * mutation flow needs the row before its fine permission check. */
  private async load(memberId: string) {
    const row = await this.prisma.membership.findUnique({ where: { id: memberId } });
    if (!row) throw new NotFoundException(`No member with id "${memberId}"`);
    return row;
  }

  private assertUpdate(
    subject: PermissionSubject,
    row: { clubId: string },
    resource: 'member' | 'memberRole' | 'memberPermission',
    action: 'update',
  ): void {
    if (!can(subject, action, resource, { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource,
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private async wouldOrphanClubAdmin(row: {
    id: string;
    clubId: string;
    isClubAdmin: boolean;
    status: 'active' | 'removed';
  }): Promise<boolean> {
    if (!row.isClubAdmin || row.status !== 'active') return false;
    const activeAdmins = await this.prisma.membership.count({
      where: { clubId: row.clubId, isClubAdmin: true, status: 'active' },
    });
    return activeAdmins <= 1;
  }
}

/** Empty `dto.roles` falls back to a plain Member — matches the "roles are
 * optional on the Add member form" behaviour the web has had since S3. */
function normaliseRoles(input: readonly string[] | undefined): PrismaClubRole[] {
  const clubRoles =
    input && input.length > 0
      ? toClubRoles(input as import('./role-mapping').OfficerRole[])
      : ['Member' as PrismaClubRole];
  return clubRoles;
}

function currentOverrides(raw: unknown): Record<string, 'allow' | 'deny'> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, 'allow' | 'deny'> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === 'allow' || value === 'deny') out[key] = value;
  }
  return out;
}

function parsePermissionsPatch(body: unknown): Record<string, OverridePatchValue> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected a permissions body');
  }
  const out: Record<string, OverridePatchValue> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (!OVERRIDE_KEY.test(key)) {
      throw new BadRequestException(`"${key}" is not a valid <resource>:<action> key`);
    }
    if (value !== 'allow' && value !== 'deny' && value !== 'default') {
      throw new BadRequestException(`${key} must be 'allow', 'deny' or 'default'`);
    }
    out[key] = value;
  }
  return out;
}
