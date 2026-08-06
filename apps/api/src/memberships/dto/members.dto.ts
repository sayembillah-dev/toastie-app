import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { OFFICER_ROLES, type OfficerRole } from '../role-mapping';

const NAME_MAX = 60;

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  lastName!: string;

  /** Absent or empty → `['Member']`. The web form intentionally lets a Club
   * Admin add a plain member with no role picker on the "Add member" flow. */
  @IsOptional()
  @IsArray()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];
}

export class UpdateMemberDto {
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
