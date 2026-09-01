import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ClubRole as PrismaClubRole, type Prospect } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';
import { resolveNamePatch, resolveNames, splitFullName } from '@/common';
import { IdentityService } from '@/identity';
import { InvitesService } from '@/invites';
import {
  MEMBERSHIP_AVATAR_INCLUDE,
  MembershipsService,
  type MemberWire,
  type OfficerRole,
  toClubRoles,
  toMemberWire,
} from '@/memberships';
import { PrismaService } from '@/prisma';
import { StorageService } from '@/storage';

import type { SubmitGuestInviteDto } from './dto/guest-invite.dto';
import type { ConvertGuestDto, CreateGuestDto, UpdateGuestDto } from './dto/guests.dto';
import type {
  CreateContactLogDto,
  CreateVisitLogDto,
  UpdateContactLogDto,
  UpdateVisitLogDto,
} from './dto/logs.dto';
import {
  type ContactLogWire,
  type ConvertGuestResultWire,
  emptyPersonLookup,
  GUEST_PERSON_INCLUDE,
  type GuestMatchWire,
  type GuestWire,
  type PersonLookupWire,
  type ProspectWithPerson,
  toContactLogWire,
  toGuestWire,
  toGuestWires,
  toPersonLookupWire,
  toVisitLogWire,
  type VisitLogWire,
} from './serializers';
import { syncGuestVisitStats } from './visit-stats';

type GuestMatch =
  | { status: 'no-match' }
  | { status: 'already-member'; membership: MemberWire }
  | {
      status: 'existing-user';
      user: { id: string; firstName: string; lastName: string; phone: string };
    };

/** Handles `/guests` and its nested contact/visit log surfaces. The DB
 * model is `Prospect` — the local-db rename kept the wire calling it
 * "Guest" so this service translates at the boundary. */
@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: MembershipsService,
    private readonly invites: InvitesService,
    private readonly storage: StorageService,
    private readonly identity: IdentityService,
  ) {}

  /** ------------------------------------------------------------ guests -- */

  async listGuests(subject: PermissionSubject, clubId: string): Promise<GuestWire[]> {
    if (!can(subject, 'read', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.prospect.findMany({
      where: { clubId },
      include: GUEST_PERSON_INCLUDE,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return toGuestWires(rows, this.storage);
  }

  /** Search for members who can be added as guests to a club — excludes
   * those already in the target club. Returns basic info for UI selection. */
  async searchMembersForGuestAdd(
    subject: PermissionSubject,
    clubId: string,
    query?: string,
  ): Promise<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      clubName: string;
    }>
  > {
    if (!can(subject, 'create', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }

    const searchTerm = query?.toLowerCase() ?? '';
    const rows = await this.prisma.membership.findMany({
      where: {
        // Exclude members already in the target club
        NOT: { clubId },
        // Search by name or email if query provided
        ...(searchTerm && {
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        club: { select: { name: true } },
        user: { select: { email: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50, // Limit results for performance
    });

    return rows.map((row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.user?.email ?? null,
      clubName: row.club.name,
    }));
  }

  async getGuest(subject: PermissionSubject, guestId: string): Promise<GuestWire> {
    const row = await this.loadGuest(guestId);
    this.assertGuest(subject, row, 'read');
    return toGuestWire(row, this.storage);
  }

  /** The only place a guest is created — meeting attendance and meeting-role
   * pickers only ever link to an existing `Prospect`, never mint one.
   *
   * Can create by either manually entering details (firstName + optional fields)
   * or by providing a membershipId to add an existing member as a guest. */
  async createGuest(
    subject: PermissionSubject,
    clubId: string,
    dto: CreateGuestDto,
  ): Promise<GuestWire> {
    if (!can(subject, 'create', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }

    let firstName: string;
    let lastName: string;
    let email: string | null;
    let phone: string | null;

    if (dto.membershipId) {
      // Adding an existing member as a guest
      const membership = await this.prisma.membership.findUnique({
        where: { id: dto.membershipId },
        include: {
          user: {
            select: { email: true },
          },
        },
      });
      if (!membership) {
        throw new NotFoundException(`No member with id "${dto.membershipId}"`);
      }

      // Prevent adding someone who's already a member of the target club
      if (membership.clubId === clubId) {
        throw new ConflictException({
          code: 'ALREADY_MEMBER',
          message: 'This person is already a member of this club',
        });
      }

      firstName = membership.firstName;
      lastName = membership.lastName;
      email = membership.user?.email ?? null;
      phone = membership.phone;
    } else {
      // Manual guest entry — a name is required (single `name` input or the
      // legacy first/last pair).
      const names = resolveNames(dto);
      if (!names) {
        throw new BadRequestException({
          code: 'MISSING_FIRST_NAME',
          message: 'Either name or membershipId is required',
        });
      }
      firstName = names.firstName;
      lastName = names.lastName;
      email = dto.email ?? null;
      phone = dto.phone ?? null;
    }

    if (dto.avatarUrl) this.storage.assertOwnedKey(dto.avatarUrl, 'guestAvatar', clubId);
    // Resolve the global identity for this number first — the guest row is
    // born linked, and still-empty person fields are filled from this entry.
    const person = await this.identity.ensurePerson(phone, {
      firstName,
      lastName,
      email,
      whatsapp: dto.whatsapp,
      organization: dto.organization,
      bio: dto.bio,
      socials: dto.socials,
    });
    const row = await this.prisma.prospect.create({
      data: {
        clubId,
        personId: person?.id ?? null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email?.trim() || null,
        phone,
        whatsapp: dto.whatsapp ?? null,
        organization: dto.organization?.trim() || null,
        avatarUrl: dto.avatarUrl || null,
        socials: (dto.socials ?? []) as unknown as Prisma.InputJsonValue,
        bio: dto.bio?.trim() || null,
        notes: dto.notes?.trim() || null,
        invitedBy: dto.invitedBy?.trim() || null,
        stage: 'new',
      },
      include: GUEST_PERSON_INCLUDE,
    });
    return toGuestWire(row, this.storage);
  }

  /** ------------------------------------------- guest self-signup link -- */

  /** The club's standing public signup link (`/guest-invite/<token>`), read
   * from the Invite-guest dialog on People → Guests. Minted lazily on first
   * read and reused until rotated. `guest:create` gated — the same grant as
   * adding a guest by hand, since the link's whole purpose is adding guests. */
  async getGuestInviteLink(subject: PermissionSubject, clubId: string): Promise<{ token: string }> {
    this.assertCanCreateGuest(subject, clubId);

    const existing = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: { guestInviteToken: true },
    });
    if (!existing) throw new NotFoundException(`No club with id "${clubId}"`);
    if (existing.guestInviteToken) return { token: existing.guestInviteToken };

    // First read for this club — mint one. The `updateMany` is guarded on the
    // token still being null so a concurrent first-read can't clobber the
    // winner's token; every caller then re-reads whatever was stored.
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = randomBytes(32).toString('base64url');
      try {
        await this.prisma.club.updateMany({
          where: { id: clubId, guestInviteToken: null },
          data: { guestInviteToken: token },
        });
        const stored = await this.prisma.club.findUniqueOrThrow({
          where: { id: clubId },
          select: { guestInviteToken: true },
        });
        if (stored.guestInviteToken) return { token: stored.guestInviteToken };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new InternalServerErrorException('Could not mint a guest invite token');
  }

  /** Swaps the club's self-signup token for a fresh one — the previous link
   * and every QR printed from it stop working immediately. */
  async rotateGuestInviteLink(
    subject: PermissionSubject,
    clubId: string,
  ): Promise<{ token: string }> {
    this.assertCanCreateGuest(subject, clubId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = randomBytes(32).toString('base64url');
      try {
        await this.prisma.club.update({ where: { id: clubId }, data: { guestInviteToken: token } });
        return { token };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new InternalServerErrorException('Could not rotate the guest invite token');
  }

  /** Public preview for `/guest-invite/:token` — just the club's name, so the
   * anonymous form can greet the visitor by club. An unknown token 404s; the
   * link has no expiry or use count. */
  async previewGuestInvite(token: string): Promise<{ clubName: string }> {
    const club = await this.prisma.club.findUnique({
      where: { guestInviteToken: token },
      select: { name: true },
    });
    if (!club) throw new NotFoundException('No guest invite matches that link');
    return { clubName: club.name };
  }

  /** The public form's submit — drops a fresh `new`-stage `Prospect` into the
   * club's pipeline. Deduped on phone per club so a double-tap (or a repeat
   * signup months later) surfaces as a friendly "already on the list" rather
   * than a second pipeline row. */
  async submitGuestInvite(token: string, dto: SubmitGuestInviteDto): Promise<{ id: string }> {
    const club = await this.prisma.club.findUnique({
      where: { guestInviteToken: token },
      select: { id: true },
    });
    if (!club) throw new NotFoundException('No guest invite matches that link');

    const duplicate = await this.prisma.prospect.findFirst({
      where: { clubId: club.id, phone: dto.phone },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException({
        code: 'GUEST_ALREADY_ON_LIST',
        message: 'This number is already on the guest list',
      });
    }

    const { firstName, lastName } = splitFullName(dto.name);
    // Same identity link as the authed quick-add — a self-invited guest joins
    // the global pool too.
    const person = await this.identity.ensurePerson(dto.phone, {
      firstName,
      lastName,
      organization: dto.organization,
      bio: dto.bio,
    });
    const row = await this.prisma.prospect.create({
      data: {
        clubId: club.id,
        personId: person?.id ?? null,
        // A single-word name leaves lastName empty, same as the quick-add
        // drawer; the caps mirror the authed guest DTOs.
        firstName: firstName.slice(0, 60),
        lastName: lastName.slice(0, 60),
        phone: dto.phone,
        organization: dto.organization?.trim() || null,
        bio: dto.bio?.trim() || null,
        invitedBy: 'Self-invite link',
        stage: 'new',
      },
    });
    return { id: row.id };
  }

  /** Number-first lookup (IDENTITY_PLAN §7): everything the global pool
   * knows about a phone number — shared profile, cross-club memberships —
   * plus this club's own history with it. Powers the add-guest/add-member
   * autofill card. Available to anyone who may add guests OR members. */
  async lookupPerson(
    subject: PermissionSubject,
    clubId: string,
    rawPhone: string,
  ): Promise<PersonLookupWire> {
    if (
      !can(subject, 'create', 'guest', { clubId }) &&
      !can(subject, 'create', 'member', { clubId })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'You do not have permission to look people up',
      });
    }
    const person = await this.identity.findByPhone(rawPhone);
    if (!person) return emptyPersonLookup();

    const [memberships, guestsHere, memberHere] = await Promise.all([
      this.prisma.membership.findMany({
        where: { personId: person.id, status: 'active' },
        select: { clubId: true, roles: true, club: { select: { name: true } } },
      }),
      this.prisma.prospect.findMany({
        where: { personId: person.id, clubId },
        select: { id: true },
      }),
      this.prisma.membership.findFirst({
        where: { personId: person.id, clubId, status: 'active' },
        select: { id: true },
      }),
    ]);

    const guestIds = guestsHere.map((g) => g.id);
    const [visitCount, roleCount, speechCount, lastVisitRow] =
      guestIds.length > 0
        ? await Promise.all([
            this.prisma.meetingGuestAttendance.count({
              where: { guestId: { in: guestIds }, present: true },
            }),
            this.prisma.meetingRoleAssignment.count({ where: { guestId: { in: guestIds } } }),
            this.prisma.meetingSpeaker.count({ where: { guestId: { in: guestIds } } }),
            this.prisma.meetingGuestAttendance.findFirst({
              where: { guestId: { in: guestIds } },
              orderBy: { meeting: { dateTime: 'desc' } },
              select: { meeting: { select: { dateTime: true } } },
            }),
          ])
        : [0, 0, 0, null];

    return toPersonLookupWire(
      person,
      {
        memberOf: memberships.map((m) => ({
          clubId: m.clubId,
          clubName: m.club.name,
          roles: m.roles.map(String),
        })),
        isGuest: guestsHere.length > 0,
        guestId: guestsHere[0]?.id,
        isMember: memberHere !== null,
        visitCount,
        roleCount,
        speechCount,
        lastVisit: lastVisitRow?.meeting.dateTime.toISOString(),
      },
      this.storage,
    );
  }

  private assertCanCreateGuest(subject: PermissionSubject, clubId: string): void {
    if (!can(subject, 'create', 'guest', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
  }

  async updateGuest(
    subject: PermissionSubject,
    guestId: string,
    dto: UpdateGuestDto,
  ): Promise<GuestWire> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'update');

    const data: Prisma.ProspectUpdateInput = {};
    const namePatch = resolveNamePatch(dto);
    if (namePatch.firstName !== undefined) data.firstName = namePatch.firstName;
    if (namePatch.lastName !== undefined) data.lastName = namePatch.lastName;
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.phone !== undefined) {
      data.phone = dto.phone;
      // Re-resolve the global identity: fixing a typo'd number re-links this
      // guest to a different person; an unusable one keeps the row club-local.
      const person = await this.identity.ensurePerson(dto.phone, {
        firstName: namePatch.firstName ?? existing.firstName,
        lastName: namePatch.lastName ?? existing.lastName,
        email: existing.email,
        whatsapp: existing.whatsapp,
        organization: existing.organization,
        bio: existing.bio,
      });
      data.person = person ? { connect: { id: person.id } } : { disconnect: true };
    }
    if (dto.whatsapp !== undefined) data.whatsapp = dto.whatsapp;
    if (dto.organization !== undefined) data.organization = dto.organization.trim() || null;
    if (dto.avatarUrl !== undefined) {
      if (dto.avatarUrl) {
        this.storage.assertOwnedKey(dto.avatarUrl, 'guestAvatar', existing.clubId);
      }
      data.avatarUrl = dto.avatarUrl || null;
    }
    if (dto.socials !== undefined) data.socials = dto.socials as unknown as Prisma.InputJsonValue;
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    if (dto.invitedBy !== undefined) data.invitedBy = dto.invitedBy.trim() || null;
    if (dto.stage !== undefined) data.stage = dto.stage;

    const row = await this.prisma.prospect.update({
      where: { id: guestId },
      data,
      include: GUEST_PERSON_INCLUDE,
    });
    // Write-through to the shared person (IDENTITY_PLAN §5): last non-empty
    // club write wins while the number is unclaimed; once claimed, the
    // account holder is authoritative and this is a no-op.
    if (existing.personId) {
      await this.identity.applyClubSource(existing.personId, {
        firstName: namePatch.firstName,
        lastName: namePatch.lastName,
        email: dto.email?.trim(),
        whatsapp: dto.whatsapp,
        organization: dto.organization,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
      });
    }
    if (dto.avatarUrl !== undefined && existing.avatarUrl && existing.avatarUrl !== row.avatarUrl) {
      await this.storage.remove(existing.avatarUrl);
    }
    return toGuestWire(row, this.storage);
  }

  /** Hard delete. Contact/visit logs cascade via the DB FK (matches the
   * local-db's manual cascade at `handlers.ts:951-952`). */
  async deleteGuest(subject: PermissionSubject, guestId: string): Promise<null> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'delete');
    await this.prisma.prospect.delete({ where: { id: guestId } });
    await this.storage.remove(existing.avatarUrl);
    return null;
  }

  /** Read-only preview of what converting this guest would do — the
   * frontend calls this before showing the convert dialog's confirmation
   * state, so an admin sees "matches an existing account" or "already a
   * member" before committing to anything. */
  async checkGuestMatch(subject: PermissionSubject, guestId: string): Promise<GuestMatchWire> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'read');

    const match = await this.resolveGuestMatch(existing);
    if (match.status === 'no-match') return { status: 'no-match' };
    if (match.status === 'already-member') {
      return { status: 'already-member', membership: match.membership };
    }
    return {
      status: 'existing-user',
      user: {
        firstName: match.user.firstName,
        lastName: match.user.lastName,
        phoneMasked: maskPhone(match.user.phone),
      },
    };
  }

  /** Turns a guest into a member — the guest row is kept and moved to the
   * `joined-club` stage so the pipeline history survives. The match against
   * `Prospect.phone` is re-derived here (never trusts anything the client
   * sent from the preview call) and decides what "portal access" means:
   *  - already a member of this club → refused, nothing written.
   *  - phone matches an existing `User` with no membership here yet → the
   *    new `Membership` is claimed immediately (`userId` set); they already
   *    have login access, so no invite is needed.
   *  - no match → today's unclaimed `Membership`, plus an `Invite` targeted
   *    at that exact row (`Invite.membershipId`) so accepting it later
   *    claims this row instead of creating a duplicate one
   *    (`InvitesService.acceptByToken`). */
  async convertToMember(
    subject: PermissionSubject,
    actorUserId: string,
    guestId: string,
    dto: ConvertGuestDto,
  ): Promise<ConvertGuestResultWire> {
    const existing = await this.loadGuest(guestId);
    this.assertGuest(subject, existing, 'update');

    const officerRoles: OfficerRole[] =
      dto.roles && dto.roles.length > 0 ? dto.roles : (['Member'] as OfficerRole[]);
    const roles: PrismaClubRole[] = toClubRoles(officerRoles);

    const match = await this.resolveGuestMatch(existing);

    if (match.status === 'already-member') {
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'This guest is already a member of this club',
      });
    }

    const [, membership] = await this.prisma.$transaction([
      this.prisma.prospect.update({
        where: { id: guestId },
        data: { stage: 'joined-club' },
      }),
      this.prisma.membership.create({
        data: {
          clubId: existing.clubId,
          userId: match.status === 'existing-user' ? match.user.id : undefined,
          // Carry the guest's global identity onto the roster row — same
          // person, new club-scoped role.
          personId: existing.personId,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          roles,
          isClubAdmin: false,
          status: 'active',
          grantOverrides: {},
        },
        include: MEMBERSHIP_AVATAR_INCLUDE,
      }),
    ]);

    if (match.status === 'existing-user') {
      return { membership: await toMemberWire(membership, this.storage), outcome: 'claimed' };
    }

    // No match — the roster row above is unclaimed. Auto-generate an invite
    // targeted at it right away rather than leaving the admin to remember a
    // separate step; if this fails, the membership still exists (today's
    // pre-fix behavior) and the admin can create an invite by hand instead.
    const invite = await this.invites.create(subject, existing.clubId, actorUserId, {
      inviteeName: [existing.firstName, existing.lastName].filter(Boolean).join(' '),
      roles: officerRoles,
      membershipId: membership.id,
    });

    return {
      membership: await toMemberWire(membership, this.storage),
      outcome: 'unclaimed',
      invite,
    };
  }

  private async resolveGuestMatch(guest: Prospect): Promise<GuestMatch> {
    if (!guest.phone) return { status: 'no-match' };
    const user = await this.memberships.findMatchingUser(guest.phone);
    if (!user) return { status: 'no-match' };
    const existingMembership = await this.memberships.findExistingMembership(guest.clubId, user.id);
    if (existingMembership) return { status: 'already-member', membership: existingMembership };
    return { status: 'existing-user', user };
  }

  /** ----------------------------------------------------- contact logs -- */

  async listContactLogs(subject: PermissionSubject, guestId: string): Promise<ContactLogWire[]> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'read');
    const rows = await this.prisma.contactLog.findMany({
      where: { clubId: guest.clubId, prospectId: guest.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toContactLogWire);
  }

  async createContactLog(
    subject: PermissionSubject,
    guestId: string,
    dto: CreateContactLogDto,
  ): Promise<ContactLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'create');
    const row = await this.prisma.contactLog.create({
      data: {
        clubId: guest.clubId,
        prospectId: guest.id,
        method: dto.method,
        outcome: dto.outcome.trim(),
      },
    });
    return toContactLogWire(row);
  }

  async updateContactLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
    dto: UpdateContactLogDto,
  ): Promise<ContactLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'update');
    const existing = await this.prisma.contactLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No contact log with id "${logId}"`);
    }
    const data: Prisma.ContactLogUpdateInput = { updatedAt: new Date() };
    if (dto.method !== undefined) data.method = dto.method;
    if (dto.outcome !== undefined) data.outcome = dto.outcome.trim();
    const row = await this.prisma.contactLog.update({ where: { id: logId }, data });
    return toContactLogWire(row);
  }

  async deleteContactLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
  ): Promise<null> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'delete');
    const existing = await this.prisma.contactLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No contact log with id "${logId}"`);
    }
    await this.prisma.contactLog.delete({ where: { id: logId } });
    return null;
  }

  /** ------------------------------------------------------ visit logs -- */

  async listVisitLogs(subject: PermissionSubject, guestId: string): Promise<VisitLogWire[]> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'read');
    // Server orders by the meeting date (matches local-db behaviour); logs
    // with a nulled `meetingId` (meeting deleted) fall to the bottom by
    // `createdAt`. A single query with `meeting: { dateTime }` sort keeps
    // it one round-trip.
    const rows = await this.prisma.visitLog.findMany({
      where: { clubId: guest.clubId, prospectId: guest.id },
      orderBy: [{ meeting: { dateTime: 'desc' } }, { createdAt: 'desc' }],
    });
    return rows.map(toVisitLogWire);
  }

  async createVisitLog(
    subject: PermissionSubject,
    guestId: string,
    dto: CreateVisitLogDto,
  ): Promise<VisitLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'create');
    await this.assertMeetingInClub(guest.clubId, dto.meetingId);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.visitLog.create({
        data: {
          clubId: guest.clubId,
          prospectId: guest.id,
          meetingId: dto.meetingId,
          role: dto.role?.trim() || null,
          notes: dto.notes?.trim() || null,
          origin: 'manual',
        },
      });
      await syncGuestVisitStats(tx, guest.id);
      return created;
    });
    return toVisitLogWire(row);
  }

  async updateVisitLog(
    subject: PermissionSubject,
    guestId: string,
    logId: string,
    dto: UpdateVisitLogDto,
  ): Promise<VisitLogWire> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'update');
    const existing = await this.prisma.visitLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No visit log with id "${logId}"`);
    }
    const data: Prisma.VisitLogUpdateInput = { updatedAt: new Date() };
    if (dto.meetingId !== undefined) {
      await this.assertMeetingInClub(guest.clubId, dto.meetingId);
      data.meeting = { connect: { id: dto.meetingId } };
    }
    if (dto.role !== undefined) data.role = dto.role.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;
    // Origin is a source-of-record marker, not editable — a hand-edited
    // auto log stays auto. Skip on purpose.
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitLog.update({ where: { id: logId }, data });
      // Only the meeting link affects the derived stats — role/notes edits
      // don't move the visit-date needle.
      if (dto.meetingId !== undefined) await syncGuestVisitStats(tx, guest.id);
      return updated;
    });
    return toVisitLogWire(row);
  }

  async deleteVisitLog(subject: PermissionSubject, guestId: string, logId: string): Promise<null> {
    const guest = await this.loadGuest(guestId);
    this.assertLog(subject, guest, 'delete');
    const existing = await this.prisma.visitLog.findUnique({ where: { id: logId } });
    if (!existing || existing.prospectId !== guest.id) {
      throw new NotFoundException(`No visit log with id "${logId}"`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.visitLog.delete({ where: { id: logId } });
      await syncGuestVisitStats(tx, guest.id);
    });
    return null;
  }

  /** ---------------------------------------------------------- helpers -- */

  private async loadGuest(guestId: string): Promise<ProspectWithPerson> {
    const row = await this.prisma.prospect.findUnique({
      where: { id: guestId },
      include: GUEST_PERSON_INCLUDE,
    });
    if (!row) throw new NotFoundException(`No guest with id "${guestId}"`);
    return row;
  }

  private assertGuest(
    subject: PermissionSubject,
    row: { clubId: string },
    action: 'read' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'guest', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guest',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private assertLog(
    subject: PermissionSubject,
    row: { clubId: string },
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'guestLog', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'guestLog',
        action,
        reason: 'You do not manage this club',
      });
    }
  }

  private async assertMeetingInClub(clubId: string, meetingId: string): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, clubId: true },
    });
    if (!meeting || meeting.clubId !== clubId) {
      throw new BadRequestException(`No meeting with id "${meetingId}"`);
    }
  }
}

/** Shows enough of a matched account's phone for an admin to recognise it
 * without exposing the full number in a confirmation dialog. */
function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 6)}${phone.slice(-3)}`;
}
