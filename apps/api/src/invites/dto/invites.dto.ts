import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

const NAME_MAX = 60;

/** Body for `POST /invites`. `roles` is optional — an empty selection means
 * "invite as a plain Member" and is normalised in the service, mirroring the
 * web modal in `components/club-admin/invite-modal.tsx`. */
export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX)
  lastName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(OFFICER_ROLES, { each: true })
  roles?: OfficerRole[];
}
