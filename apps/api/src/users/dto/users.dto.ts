import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';
import { MEMBER_TYPES, type MemberType, OFFICER_ROLES, type OfficerRole } from '@/memberships';

const USER_STATUSES = ['active', 'suspended'] as const;

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class SetUserStatusDto {
  @IsIn(USER_STATUSES)
  status!: (typeof USER_STATUSES)[number];
}

export class SetUserAdminDto {
  @IsBoolean()
  isSuperAdmin!: boolean;
}

/** Permanent bulk delete — capped well above any realistic single
 * selection so a fat-fingered request can't take down the whole table. */
export class BulkDeleteUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  userIds!: string[];
}

/** Profile-field edit from the Super Admin's user detail panel. Every field
 * optional — a save only sends what changed. */
export class UpdateUserDto {
  /** Single "Full name" input — split server-side, wins over the pair. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(161)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  /** Sign-in email. Can be changed but not cleared — an account with no
   * email cannot sign in once phone sign-in goes away. A change is saved
   * unverified: the member must prove the inbox at the "verify your email"
   * gate. */
  @IsOptional()
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === undefined ? value : normalizePhone(value)))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tiMemberNumber?: string;
}

/** Admin-driven password reset — same strength requirement as account
 * creation. The new password is never echoed back in the response. */
export class SetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;
}

/** Super Admin's direct-provision flow — creates the `User` row and,
 * optionally in the same transaction, a `Membership` claimed by that user
 * immediately (no separate accept-invite step). Phone validation mirrors
 * `RegisterDto`; `email` is required (the sign-in identifier); `password` is SA-supplied so it can be handed to the
 * person out of band (the credentials card the client renders on
 * success), never emailed or stored in plaintext past this request. */
export class CreateUserDto {
  @IsString()
  @Transform(({ value }) => normalizePhone(value))
  @Matches(PHONE_REGEX, {
    message: 'Phone must be exactly 11 digits',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;

  /** Single "Full name" input — split server-side, wins over the pair. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(161)
  name?: string;

  /** Legacy pair — optional now that `name` is canonical; the service
   * rejects a submission that carries neither. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  /** Required: the member signs in with it. Saved unverified — the admin
   * cannot prove the member reads this inbox, so the member proves it at
   * the "verify your email" gate after the first sign-in. */
  @Transform(normaliseEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(255)
  email!: string;

  /** Toastmasters International member number — a person-level identifier,
   * independent of any club placement below. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tiMemberNumber?: string;

  /** Omit to create a bare account with no club membership. */
  @IsOptional()
  @IsString()
  clubId?: string;

  /** Only meaningful alongside `clubId`. Absent or empty → `['Member']`,
   * matching `CreateMemberDto`'s existing default. */
  @IsOptional()
  @IsArray()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];

  /** Only meaningful alongside `clubId`. */
  @IsOptional()
  @IsBoolean()
  isClubAdmin?: boolean;

  /** Only meaningful alongside `clubId`. */
  @IsOptional()
  @IsIn(MEMBER_TYPES)
  memberType?: MemberType;
}
