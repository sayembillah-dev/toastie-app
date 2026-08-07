import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

import { MEMBER_TYPES, type MemberType, OFFICER_ROLES, type OfficerRole } from '@/memberships';

const MEMBERSHIP_STATUSES = ['active', 'removed'] as const;

/** Super Admin placing an existing user into another club — the club-scoped
 * `CreateMemberDto` (in `memberships/dto/members.dto.ts`) has no `clubId`
 * (it's implied by `X-Toastly-Context`) and no `userId` (it always creates
 * an unclaimed roster row); this is the SA's equivalent for an already-
 * claimed membership on an explicit club. */
export class CreateUserMembershipDto {
  @IsString()
  clubId!: string;

  /** Absent or empty → `['Member']`. */
  @IsOptional()
  @IsArray()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];

  @IsOptional()
  @IsBoolean()
  isClubAdmin?: boolean;

  @IsOptional()
  @IsIn(MEMBER_TYPES)
  memberType?: MemberType;
}

/** Edits one existing membership. Every field optional — the panel may
 * change roles, the Club Admin flag and status independently or together
 * in one save. */
export class UpdateUserMembershipDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];

  @IsOptional()
  @IsBoolean()
  isClubAdmin?: boolean;

  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  status?: (typeof MEMBERSHIP_STATUSES)[number];
}
