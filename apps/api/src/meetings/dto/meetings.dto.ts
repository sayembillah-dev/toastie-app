import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

const THEME_MAX = 120;

/** Body for `POST /meetings`. A meeting is born a draft; the status field
 * lives on `UpdateMeetingDto` because Publish is a separate button. */
export class CreateMeetingDto {
  @IsInt()
  @Min(1)
  meetingNumber!: number;

  @IsISO8601()
  dateTime!: string;

  @IsString()
  @MaxLength(THEME_MAX)
  theme!: string;
}

/** Body for `PATCH /meetings/:meetingId` — the Save as Draft / Publish
 * buttons on the meeting page share this shape. */
export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(THEME_MAX)
  theme?: string;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'published';
}
