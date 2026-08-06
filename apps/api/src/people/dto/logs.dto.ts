import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const CONTACT_METHODS = ['call', 'message', 'email', 'in-person', 'other'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const OUTCOME_MAX = 2000;
export const VISIT_ROLE_MAX = 80;
export const VISIT_NOTES_MAX = 2000;

/** Body for `POST /guests/:guestId/contact-logs`. */
export class CreateContactLogDto {
  @IsIn(CONTACT_METHODS as readonly string[])
  method!: ContactMethod;

  @IsString()
  @MinLength(1)
  @MaxLength(OUTCOME_MAX)
  outcome!: string;
}

/** Body for `PATCH /guests/:guestId/contact-logs/:logId`. Partial patch —
 * the panel sends the full pair today but the API stays generic. */
export class UpdateContactLogDto {
  @IsOptional()
  @IsIn(CONTACT_METHODS as readonly string[])
  method?: ContactMethod;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(OUTCOME_MAX)
  outcome?: string;
}

/** Body for `POST /guests/:guestId/visit-logs`. */
export class CreateVisitLogDto {
  @IsString()
  @MinLength(1)
  meetingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(VISIT_ROLE_MAX)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VISIT_NOTES_MAX)
  notes?: string;
}

export class UpdateVisitLogDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  meetingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VISIT_ROLE_MAX)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(VISIT_NOTES_MAX)
  notes?: string;
}
