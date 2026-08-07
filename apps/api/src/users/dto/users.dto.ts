import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

import { MEMBER_TYPES, type MemberType, OFFICER_ROLES, type OfficerRole } from '@/memberships';

const USER_STATUSES = ['active', 'suspended'] as const;

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

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s-]{8,20}$/, {
    message: 'Enter a valid phone number (8–20 digits, optional leading +)',
  })
  @MaxLength(20)
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
 * `RegisterDto`; `password` is SA-supplied so it can be handed to the
 * person out of band (the credentials card the client renders on
 * success), never emailed or stored in plaintext past this request. */
export class CreateUserDto {
  @IsString()
  @Matches(/^\+?[0-9\s-]{8,20}$/, {
    message: 'Enter a valid phone number (8–20 digits, optional leading +)',
  })
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

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
