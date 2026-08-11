import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { MEMBERSHIP_AVATAR_INCLUDE, type MemberWire, toMemberWire } from '@/memberships';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage';

import type { CreateJoinRequestDto } from './dto/join-requests.dto';
import { type JoinRequestWire, toJoinRequestWire } from './serializers';

/** Handles `/join-requests` — the self-service path a signed-up user (no
 * membership yet) uses to ask a club's Club Admin to add them.
 *
 * Ownership rules:
 *   - Any authed user can create a request for any active club (a public
 *     directory list drives club discovery). The partial index
 *     `joinreq_one_pending_per_club_user` collapses duplicates.
 *   - Only the requester can withdraw their own pending request.
 *   - Only a caller with `joinRequest:read`/`update` in the target club (i.e.
 *     Club Admin) can list, approve, or decline.
 */
@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createFromUser(userId: string, dto: CreateJoinRequestDto): Promise<JoinRequestWire> {
    const club = await this.prisma.club.findUnique({
      where: { id: dto.clubId },
      select: { id: true, joinPolicy: true, lifecycle: true },
    });
    if (!club) throw new NotFoundException(`No club with id "${dto.clubId}"`);
    if (club.lifecycle !== 'active') {
      throw new BadRequestException({
        code: 'CLUB_NOT_ACTIVE',
        message: 'This club is not accepting new members right now',
      });
    }
    if (club.joinPolicy === 'closed') {
      throw new ForbiddenException({
        code: 'CLUB_CLOSED',
        message: 'This club does not accept join requests',
      });
    }

    // Existing membership → block. The user should switch context, not
    // request a second time.
    const existingMembership = await this.prisma.membership.findFirst({
      where: { clubId: dto.clubId, userId, status: 'active' },
      select: { id: true },
    });
    if (existingMembership) {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You are already a member of this club',
      });
    }

    try {
      const row = await this.prisma.joinRequest.create({
        data: {
          clubId: dto.clubId,
          userId,
          message: dto.message?.trim() || null,
          status: 'pending',
        },
      });
      return toJoinRequestWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'JOIN_REQUEST_PENDING',
          message: 'You already have a pending join request for this club',
        });
      }
      throw err;
    }
  }

  async listForClub(
    subject: PermissionSubject,
    clubId: string,
    statusFilter?: 'pending' | 'approved' | 'declined' | 'withdrawn',
  ): Promise<JoinRequestWire[]> {
    if (!can(subject, 'read', 'joinRequest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'joinRequest',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.joinRequest.findMany({
      where: { clubId, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toJoinRequestWire);
  }

  /** The user's own view — every pending request across all clubs. Not
   * gated by `joinRequest:read` (that's the officer surface); the user is
   * reading their own paperwork. */
  async listForUser(userId: string): Promise<JoinRequestWire[]> {
    const rows = await this.prisma.joinRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toJoinRequestWire);
  }

  async approve(subject: PermissionSubject, requestId: string): Promise<MemberWire> {
    const existing = await this.load(requestId);
    if (!can(subject, 'update', 'joinRequest', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'joinRequest',
        action: 'update',
        reason: 'You do not manage this club',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'JOIN_REQUEST_NOT_PENDING',
        message: 'Only a pending request can be approved',
      });
    }

    const decidedByMembershipId = await this.callerMembershipId(subject, existing.clubId);
    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!user) {
      throw new NotFoundException(`No user with id "${existing.userId}"`);
    }

    // Approving a request and creating the membership must be atomic — a
    // half-committed approval leaves an admin with a "approved" record but
    // no roster row, and no way back short of a manual DB fix.
    const now = new Date();
    const [, membership] = await this.prisma.$transaction([
      this.prisma.joinRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          decidedByMembershipId,
          decidedAt: now,
        },
      }),
      this.prisma.membership.create({
        data: {
          clubId: existing.clubId,
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: ['Member'],
          isClubAdmin: false,
          status: 'active',
          grantOverrides: {},
        },
        include: MEMBERSHIP_AVATAR_INCLUDE,
      }),
    ]);

    return toMemberWire(membership, this.storage);
  }

  async decline(subject: PermissionSubject, requestId: string): Promise<JoinRequestWire> {
    const existing = await this.load(requestId);
    if (!can(subject, 'update', 'joinRequest', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'joinRequest',
        action: 'update',
        reason: 'You do not manage this club',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'JOIN_REQUEST_NOT_PENDING',
        message: 'Only a pending request can be declined',
      });
    }
    const decidedByMembershipId = await this.callerMembershipId(subject, existing.clubId);
    const updated = await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'declined',
        decidedByMembershipId,
        decidedAt: new Date(),
      },
    });
    return toJoinRequestWire(updated);
  }

  /** Requester withdraws their own pending request. No `@Requires` on the
   * route — the fine check here is ownership by `userId`, not a role/scope
   * grant. */
  async withdraw(userId: string, requestId: string): Promise<JoinRequestWire> {
    const existing = await this.load(requestId);
    if (existing.userId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'You can only withdraw your own join request',
      });
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException({
        code: 'JOIN_REQUEST_NOT_PENDING',
        message: 'Only a pending request can be withdrawn',
      });
    }
    const updated = await this.prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'withdrawn', decidedAt: new Date() },
    });
    return toJoinRequestWire(updated);
  }

  private async load(requestId: string) {
    const row = await this.prisma.joinRequest.findUnique({ where: { id: requestId } });
    if (!row) throw new NotFoundException(`No join request with id "${requestId}"`);
    return row;
  }

  private async callerMembershipId(
    subject: PermissionSubject,
    clubId: string,
  ): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: { clubId, userId: subject.userId, status: 'active' },
      select: { id: true },
    });
    return membership?.id ?? null;
  }
}
