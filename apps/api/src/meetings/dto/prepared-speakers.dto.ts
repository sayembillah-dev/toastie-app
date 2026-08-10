import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const SPEAKER_TITLE_MAX = 120;
export const SPEAKER_NOTES_MAX = 160;
export const MAX_SPEAKERS_PER_MEETING = 3;

export const SPEAKER_STATUSES = ['requested', 'confirmed', 'delivered'] as const;

/** Body for `POST /meetings/:meetingId/prepared-speakers`. Nothing required —
 * "Add speaker" drops a blank card at the next open slot, same as the old
 * Redux-only `speakerAdded` action did. */
export class CreatePreparedSpeakerDto {}

/** Body for `PATCH /meetings/:meetingId/prepared-speakers/:speakerId`. Every
 * field optional and independently omittable — the tab saves whichever
 * fields changed, not the whole card. `membershipId`/`guestId` (and their
 * evaluator equivalents) accept an explicit `null` to clear a pick, same
 * convention as `SetMeetingRoleDto`. */
export class UpdatePreparedSpeakerDto {
  @IsOptional()
  @IsIn(SPEAKER_STATUSES)
  status?: (typeof SPEAKER_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  membershipId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  guestId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  evaluatorMembershipId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  evaluatorGuestId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(SPEAKER_TITLE_MAX)
  title?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(60)
  duration?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  pathway?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  project?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(SPEAKER_NOTES_MAX)
  notes?: string | null;
}
