import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

/** Body for `POST /invites`. The invite is a shareable link, not addressed
 * to anyone in particular — `email` only survives for legacy callers and is
 * never set by the current invite modal. `roles` is what the admin actually
 * picks and must be non-empty. `inviteeName` is the admin's own free-text
 * label for who they expect to use the link. */
export class CreateInviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  inviteeName!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles!: OfficerRole[];
}
