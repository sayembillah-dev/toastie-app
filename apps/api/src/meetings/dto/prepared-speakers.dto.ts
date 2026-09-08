import {
  IsArray,
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

export const SPEAKER_STATUSES = ['requested', 'confirmed', 'delivered'] as const;

/** `prepared` — the classic evaluated Pathways speech; `keynote` — an
 * unevaluated address (title + speaker + manual time only). */
export const SPEAKER_KINDS = ['prepared', 'keynote'] as const;
export type SpeakerKind = (typeof SPEAKER_KINDS)[number];

/** Body for `POST /meetings/:meetingId/prepared-speakers`. Only `kind` —
 * "Add speaker" drops a blank card at the next open slot, same as the old
 * Redux-only `speakerAdded` action did, and "Add keynote" does the same
 * with `kind: 'keynote'`. The kind is fixed at creation: converting a slot
 * means deleting and re-adding it. */
export class CreatePreparedSpeakerDto {
  @IsOptional()
  @IsIn(SPEAKER_KINDS)
  kind?: SpeakerKind;
}

/** Body for `POST /meetings/:meetingId/prepared-speakers/reorder`. Must name
 * every speaker of the meeting exactly once, in the desired order — a
 * partial list would silently renumber rows the caller may never have seen. */
export class ReorderPreparedSpeakersDto {
  @IsArray()
  @IsString({ each: true })
  speakerIds!: string[];
}

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

  /* Cap is 120 rather than a Pathways-shaped 60: prepared durations are
   * bounded by the project's range in the UI anyway, while a keynote's time
   * is entered by hand and can run well past an hour. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(120)
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
