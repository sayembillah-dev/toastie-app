import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

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

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
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
