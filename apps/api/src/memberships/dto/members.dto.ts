import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { normalizePhone, PHONE_REGEX } from '@/common';

import { OFFICER_ROLES, type OfficerRole } from '../role-mapping';

const NAME_MAX = 60;

export class CreateMemberDto {
  /** The single "Full name" input — split on the first space server-side
   * (`splitFullName`). Wins over the legacy pair when both are sent. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(161)
  name?: string;

  /** Legacy pair — optional now that `name` is the canonical input; the
   * service rejects a row that carries neither. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  lastName?: string;

  /** Optional, but it is the claim key: the moment a `User` registers (or
   * already exists) with this number, this roster row — and every agenda,
   * attendance and history row keyed to it — becomes theirs. Normalised
   * exactly like the auth phone so the two always compare equal. Empty
   * string is treated as absent so the web form can bind the input as-is. */
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : normalizePhone(value),
  )
  @Matches(PHONE_REGEX, { message: 'Phone must be exactly 11 digits' })
  phone?: string;

  /** Absent or empty → `['Member']`. The web form intentionally lets a Club
   * Admin add a plain member with no role picker on the "Add member" flow. */
  @IsOptional()
  @IsArray()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];
}

/** Cap on one bulk submission — the bulk-add table in the web UI starts
 * with a handful of rows and realistic club rosters are well under this. */
const BULK_CREATE_MAX = 100;

/** Body for `POST /members/bulk` — the bulk-add table submits every row at
 * once. Rows are processed independently: ones that conflict (e.g. a phone
 * already on this roster) come back in `failed`, the rest are created. */
export class BulkCreateMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_CREATE_MAX)
  @ValidateNested({ each: true })
  @Type(() => CreateMemberDto)
  members!: CreateMemberDto[];
}

export class UpdateMemberDto {
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
  @MaxLength(NAME_MAX)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  lastName?: string;

  /** Backfill or correct the claim key on an existing row. Setting it on an
   * unclaimed row claims that row immediately when a matching account
   * already exists — the same rule as create. */
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? undefined : normalizePhone(value),
  )
  @Matches(PHONE_REGEX, { message: 'Phone must be exactly 11 digits' })
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];
}

export class SetMemberStatusDto {
  @IsIn(['active', 'removed'])
  status!: 'active' | 'removed';
}

export class SetMemberAdminDto {
  @IsBoolean()
  isClubAdmin!: boolean;
}
