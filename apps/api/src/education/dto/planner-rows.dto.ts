import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { INSTANT_MESSAGE, INSTANT_REGEX } from '../../common';

export const PLANNER_THEME_MAX = 120;
export const PLANNER_NOTES_MAX = 2000;

/** Body for `PATCH /planner-rows/:rowId`. Every field optional — the grid
 * writes one cell at a time. `assignees` is sent whole (the frontend already
 * holds the full 13-slot map) and replaces the stored JSON outright, same as
 * `PlannerIdea.attachments`. `meetingId` is set once by the "Create meeting"
 * dialog to link the row to the meeting it produced. */
export class UpdatePlannerRowDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  meetingNumber?: number | null;

  /** Stored as a string column, but the value is the same instant the linked
   * meeting holds — offset included, so the mirror can convert between the two
   * without guessing a timezone. `null` clears an undated row. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(INSTANT_REGEX, { message: INSTANT_MESSAGE })
  dateTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(PLANNER_THEME_MAX)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLANNER_NOTES_MAX)
  notes?: string;

  @IsOptional()
  @IsObject()
  assignees?: Record<string, unknown>;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  meetingId?: string | null;
}
