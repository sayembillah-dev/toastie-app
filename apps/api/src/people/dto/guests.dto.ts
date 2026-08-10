import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { OFFICER_ROLES, type OfficerRole } from '@/memberships';

export const GUEST_STAGES = [
  'new',
  'contacted',
  'interested',
  'joined-meetings',
  'joined-club',
  'not-interested',
] as const;
export type GuestStage = (typeof GUEST_STAGES)[number];

export const SOCIAL_PLATFORMS = [
  'linkedin',
  'facebook',
  'instagram',
  'youtube',
  'twitter',
  'tiktok',
  'website',
  'other',
] as const;

class GuestSocialDto {
  @IsIn(SOCIAL_PLATFORMS as readonly string[])
  platform!: string;

  @IsString()
  @MaxLength(400)
  url!: string;
}

/** Body for `PATCH /guests/:guestId`. Every field is optional so the Kanban
 * drop, mobile dropdown, and edit panel can share this shape. */
export class UpdateGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GuestSocialDto)
  socials?: GuestSocialDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invitedBy?: string;

  @IsOptional()
  @IsIn(GUEST_STAGES as readonly string[])
  stage?: GuestStage;
}

/** Body for `POST /guests`. No `stage` — every guest starts at `new` — and no
 * visit stats, which are derived from `VisitLog` rows (see `visit-stats.ts`)
 * rather than typed in by hand. */
export class CreateGuestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => GuestSocialDto)
  socials?: GuestSocialDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invitedBy?: string;
}

/** Body for `POST /guests/:guestId/convert-to-member`. */
export class ConvertGuestDto {
  @IsOptional()
  @IsArray()
  @IsIn(OFFICER_ROLES as readonly string[], { each: true })
  roles?: OfficerRole[];
}
