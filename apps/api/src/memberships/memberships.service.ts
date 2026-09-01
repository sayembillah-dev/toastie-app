import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ClubRole as PrismaClubRole } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { resolveNamePatch, resolveNames } from '@/common';
import { IdentityService } from '@/identity';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage/storage.service';

import type {
  BulkCreateMembersDto,
  CreateMemberDto,
  SetMemberAdminDto,
  SetMemberStatusDto,
  UpdateMemberDto,
} from './dto/members.dto';
import type { MemberType, OfficerRole } from './role-mapping';
import { toClubRoles } from './role-mapping';
import {
  MEMBERSHIP_AVATAR_INCLUDE,
  type MemberWire,
  type PlatformUserMembershipWire,
  toMemberWire,
  toMemberWires,
  toPlatformUserMembershipWire,
} from './serializers';

type OverridePatchValue = 'allow' | 'deny' | 'default';

const OVERRIDE_KEY = /^[a-zA-Z]+:[a-zA-Z]+$/;

/** One row of a bulk-add submission that didn't make it onto the roster.
 * `index` points at the row's position in the submitted array so the client
 * can line the failure back up with the right table row. */
export interface BulkCreateFailure {
  index: number;
  firstName: string;
  lastName: string;
  phone?: string;
  code: string;
  message: string;
}

export interface BulkCreateResult {
  created: MemberWire[];
  failed: BulkCreateFailure[];
}

/** Pulls `{ code, message }` back out of the HttpExceptions `create()`
 * throws per row — those were constructed with that exact object body. */
function rowFailure(err: ConflictException | BadRequestException): {
  code: string;
  message: string;
} {
  const body = err.getResponse();
  if (typeof body === 'object' && body !== null) {
    const { code, message } = body as { code?: unknown; message?: unknown };
    return {
      code: typeof code === 'string' ? code : 'CREATE_FAILED',
      message: typeof message === 'string' ? message : 'Could not add this row',
    };
  }
  return { code: 'CREATE_FAILED', message: String(body) };
}

/** Handles `/members` — the roster CRUD surface the Club Admin uses. Every
 * mutation runs the two-phase permission check (§2.5 of the plan): the coarse
 * `@Requires` guard checks the request's context, and the fine `can()` call
 * here checks the loaded row's own `clubId` so a caller can't PATCH a
 * membership in a club they don't hold. */
@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly identity: IdentityService,
  ) {}

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
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return toMemberWires(rows, this.storage);
  }

  /** Phone-based account lookup — used by the guest-conversion and
   * invite-accept flows to detect whether a person already has a `User`
   * account before deciding whether a roster row should be claimed
   * immediately or left unclaimed pending an invite. No permission check:
   * every caller is already inside a permission-checked flow of its own. */
  async findMatchingUser(
    phone: string,
  ): Promise<{ id: string; firstName: string; lastName: string; phone: string } | null> {
    return this.prisma.user.findUnique({
      where: { phone },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
  }

  /** Existing roster row for a user in a specific club, if any — used to
   * avoid creating a second `Membership` for someone who's already on the
   * roster there. */
  async findExistingMembership(clubId: string, userId: string): Promise<MemberWire | null> {
    const row = await this.prisma.membership.findUnique({
      where: { clubId_userId: { clubId, userId } },
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return row ? toMemberWire(row, this.storage) : null;
  }

  async get(subject: PermissionSubject, memberId: string): Promise<MemberWire> {
    const row = await this.prisma.membership.findUnique({
      where: { id: memberId },
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    if (!row) throw new NotFoundException(`No member with id "${memberId}"`);
    if (!can(subject, 'read', 'member', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    return toMemberWire(row, this.storage);
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

    // Single `name` input or the legacy first/last pair — one must resolve.
    const names = resolveNames(dto);
    if (!names) {
      throw new BadRequestException({
        code: 'NAME_REQUIRED',
        message: 'Provide the full name',
      });
    }

    // A phone number turns the roster row into a claim key: when an account
    // already exists with this number the row is born claimed; otherwise it
    // waits unclaimed until registration claims it (see AuthService.register).
    let userId: string | null = null;
    if (dto.phone) {
      const user = await this.findMatchingUser(dto.phone);
      if (user) {
        const claimedHere = await this.prisma.membership.findUnique({
          where: { clubId_userId: { clubId, userId: user.id } },
          select: { id: true },
        });
        if (claimedHere) {
          throw new ConflictException({
            code: 'MEMBER_ALREADY_ON_ROSTER',
            message: 'The account with this phone number is already on this roster.',
          });
        }
        userId = user.id;
      }
    }

    // Link the global identity for this number (fill-empty merge — a club
    // never overwrites what another club or the account contributed).
    const person = await this.identity.ensurePerson(dto.phone, {
      firstName: names.firstName,
      lastName: names.lastName,
    });

    const row = await this.prisma.membership.create({
      data: {
        clubId,
        userId,
        personId: person?.id ?? null,
        firstName: names.firstName,
        lastName: names.lastName,
        phone: dto.phone ?? null,
        roles: clubRoles,
        isClubAdmin: false,
        status: 'active',
        grantOverrides: {},
      },
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return toMemberWire(row, this.storage);
  }

  /** The bulk-add table's submit — one `create()` per row, but best-effort
   * rather than all-or-nothing: a 100-row paste shouldn't fail outright
   * because one phone number is already on the roster. Rows that conflict
   * come back in `failed` with their submission index; the rest are created.
   * Two rows carrying the same phone inside one submission would both land
   * as unclaimed rows sharing a claim key, so repeats are rejected here. */
  async bulkCreate(
    subject: PermissionSubject,
    clubId: string,
    dto: BulkCreateMembersDto,
  ): Promise<BulkCreateResult> {
    if (!can(subject, 'create', 'member', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    const created: MemberWire[] = [];
    const failed: BulkCreateFailure[] = [];
    const phonesInBatch = new Set<string>();
    for (const [index, row] of dto.members.entries()) {
      // Resolved once per row so failure records carry a displayable name
      // even when the row was submitted with the single `name` input.
      const rowNames = resolveNames(row) ?? { firstName: row.name ?? '', lastName: '' };
      if (row.phone && phonesInBatch.has(row.phone)) {
        failed.push({
          index,
          firstName: rowNames.firstName,
          lastName: rowNames.lastName,
          phone: row.phone,
          code: 'DUPLICATE_PHONE_IN_BATCH',
          message: 'Another row in this batch already uses this phone number',
        });
        continue;
      }
      try {
        created.push(await this.create(subject, clubId, row));
        if (row.phone) phonesInBatch.add(row.phone);
      } catch (err) {
        if (err instanceof ConflictException || err instanceof BadRequestException) {
          const failure: BulkCreateFailure = {
            index,
            firstName: rowNames.firstName,
            lastName: rowNames.lastName,
            ...rowFailure(err),
          };
          if (row.phone) failure.phone = row.phone;
          failed.push(failure);
          continue;
        }
        throw err;
      }
    }
    return { created, failed };
  }

  /** Super Admin's "add this existing user to another club" action —
   * distinct from `create()` above, which always makes an *unclaimed*
   * roster row (`userId` null) for a Club Admin to invite someone into
   * later. This creates an already-claimed `Membership` directly, the same
   * way `UsersService.create()` does at account-creation time, just for a
   * user who already exists. Not club-context-bound (no `clubId` check
   * against `ctx` — the caller supplies the target club explicitly), since
   * it's only reachable via the SA-only `/users/:userId/memberships` route. */
  async createForUser(
    subject: PermissionSubject,
    args: {
      userId: string;
      clubId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      roles?: OfficerRole[];
      isClubAdmin?: boolean;
      memberType?: MemberType;
    },
  ): Promise<MemberWire> {
    if (!can(subject, 'create', 'member', { clubId: args.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'member',
        action: 'create',
      });
    }
    const club = await this.prisma.club.findUnique({
      where: { id: args.clubId },
      select: { id: true },
    });
    if (!club) throw new NotFoundException(`No club with id "${args.clubId}"`);

    // The user already exists, so their person is claimed (or becomes so).
    const person = await this.identity.claimPerson(args.userId);

    try {
      const row = await this.prisma.membership.create({
        data: {
          clubId: args.clubId,
          userId: args.userId,
          personId: person?.id ?? null,
          firstName: args.firstName,
          lastName: args.lastName,
          email: args.email,
          roles: normaliseRoles(args.roles),
          isClubAdmin: args.isClubAdmin ?? false,
          memberType: args.memberType ?? null,
          status: 'active',
          grantOverrides: {},
        },
        include: MEMBERSHIP_AVATAR_INCLUDE,
      });
      return toMemberWire(row, this.storage);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ code: 'ALREADY_MEMBER' });
      }
      throw err;
    }
  }

  /** Every club membership a single user holds, across every club — the
   * Super Admin user-detail panel's view, as opposed to `list()` above
   * which is one club's roster. Reachable only via the SA-only `/users`
   * surface, so unlike every other method here there's no fine-grained
   * per-club `can()` check: the coarse `@Requires('user','read')` on the
   * controller already restricts this to Super Admin. */
  async listForUser(userId: string): Promise<PlatformUserMembershipWire[]> {
    const rows = await this.prisma.membership.findMany({
      where: { userId },
      include: { club: { select: { name: true } }, ...MEMBERSHIP_AVATAR_INCLUDE },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return Promise.all(
      rows.map((row) => toPlatformUserMembershipWire(row, row.club.name, this.storage)),
    );
  }

  async update(
    subject: PermissionSubject,
    memberId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberWire> {
    const existing = await this.load(memberId);
    this.assertUpdate(subject, existing, 'member', 'update');

    const data: Prisma.MembershipUpdateInput = {};
    const namePatch = resolveNamePatch(dto);
    if (namePatch.firstName !== undefined) data.firstName = namePatch.firstName;
    if (namePatch.lastName !== undefined) data.lastName = namePatch.lastName;
    if (dto.roles !== undefined) {
      // Preserve the ClubAdmin marker if it's already there — `roles` is a
      // roster-role list and toggling admin lives on its own endpoint.
      const preserveAdmin = existing.roles.includes('ClubAdmin');
      const mapped = toClubRoles(dto.roles);
      data.roles = preserveAdmin ? [...mapped, 'ClubAdmin' as PrismaClubRole] : mapped;
    }

    // Backfilling a phone on an unclaimed row claims it immediately when a
    // matching account already exists — the same rule as create(). Clearing
    // is not supported: fixing a wrong number means typing the right one.
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
      if (!existing.userId) {
        const user = await this.findMatchingUser(dto.phone);
        if (user) {
          const claimedHere = await this.prisma.membership.findUnique({
            where: { clubId_userId: { clubId: existing.clubId, userId: user.id } },
            select: { id: true },
          });
          if (claimedHere) {
            throw new ConflictException({
              code: 'MEMBER_ALREADY_ON_ROSTER',
              message: 'The account with this phone number is already on this roster.',
            });
          }
          data.user = { connect: { id: user.id } };
        }
      }
      // Re-resolve the global identity: a corrected number re-links this
      // roster row to a different person; an unusable one unlinks it.
      const person = await this.identity.ensurePerson(dto.phone, {
        firstName: namePatch.firstName ?? existing.firstName,
        lastName: namePatch.lastName ?? existing.lastName,
        email: existing.email,
      });
      data.person = person ? { connect: { id: person.id } } : { disconnect: true };
    }

    const updated = await this.prisma.membership.update({
      where: { id: memberId },
      data,
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    // Write-through to the shared person for unclaimed roster rows
    // (IDENTITY_PLAN §5); a no-op once the account holder owns the number.
    if (existing.personId) {
      await this.identity.applyClubSource(existing.personId, {
        firstName: namePatch.firstName,
        lastName: namePatch.lastName,
      });
    }
    return toMemberWire(updated, this.storage);
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
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return toMemberWire(updated, this.storage);
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
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return toMemberWire(updated, this.storage);
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
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
    return toMemberWire(updated, this.storage);
  }

  /** Loads a membership by id or throws a 404. Kept private because every
   * mutation flow needs the row before its fine permission check. */
  private async load(memberId: string) {
    const row = await this.prisma.membership.findUnique({
      where: { id: memberId },
      include: MEMBERSHIP_AVATAR_INCLUDE,
    });
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
