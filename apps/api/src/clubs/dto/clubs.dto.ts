import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const NAME_MAX = 80;
const CLUB_NUMBER_MAX = 20;

/** Mirrors `ORG_CLUB_STATUSES` in `lib/org/types.ts` — the wire enum the web
 * UI still uses. Maps 1:1 to Prisma's `ClubDirectoryStatus`. */
export const ORG_CLUB_STATUSES = ['active', 'low', 'suspended'] as const;
export type OrgClubStatus = (typeof ORG_CLUB_STATUSES)[number];

export class CreateOrgClubDto {
  @IsString()
  @MinLength(1)
  areaId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CLUB_NUMBER_MAX)
  clubNumber?: string;

  @IsOptional()
  @IsEnum(ORG_CLUB_STATUSES)
  status?: OrgClubStatus;
}

export class UpdateOrgClubDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX)
  name?: string;

  /** `null` explicitly clears the number; `undefined` leaves it alone. */
  @IsOptional()
  @IsString()
  @MaxLength(CLUB_NUMBER_MAX)
  clubNumber?: string | null;

  @IsOptional()
  @IsEnum(ORG_CLUB_STATUSES)
  status?: OrgClubStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  areaId?: string;
}
