import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional } from 'class-validator';

import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

/** Body for `POST /invites`. The invite is a shareable link, not addressed
 * to anyone in particular — `email` only survives for legacy callers and is
 * never set by the current invite modal. `roles` is what the admin actually
 * picks and must be non-empty. */
export class CreateInviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles!: OfficerRole[];
}
