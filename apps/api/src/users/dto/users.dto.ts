import { Type } from 'class-transformer';
import {
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

import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

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
}

export class SetUserStatusDto {
  @IsIn(USER_STATUSES)
  status!: (typeof USER_STATUSES)[number];
}

export class SetUserAdminDto {
  @IsBoolean()
  isSuperAdmin!: boolean;
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
  @MinLength(12, { message: 'Password must be at least 12 characters' })
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
}
