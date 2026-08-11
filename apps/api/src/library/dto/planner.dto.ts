import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const PLANNER_IDEA_STATUSES = ['created', 'drafted', 'published'] as const;
export type PlannerIdeaStatusValue = (typeof PLANNER_IDEA_STATUSES)[number];

export const PLANNER_IDEA_TITLE_MAX = 200;
export const PLANNER_IDEA_BODY_MAX = 5000;
/** The name is metadata beside the object key, so this ceiling is about
 * keeping a rogue paste out of the Json column rather than about payload
 * size — the bytes live in S3. */
export const PLANNER_IDEA_ATTACHMENTS_MAX = 20;
export const PLANNER_ATTACHMENT_NAME_MAX = 260;

/** yyyy-mm-dd. Enforced on the wire so the string range query in
 * `listIdeas` can rely on lexicographic ordering matching chronological
 * ordering — `2026-9-1` would silently sort wrong. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** One file pinned to a planner idea.
 *
 * `key` is an S3 object obtained from `POST /uploads/sign`, and is optional
 * only so ideas saved before attachments carried real bytes still validate —
 * those recorded a name and nothing else. New attachments always carry one;
 * the service pins it to the caller's club before storing. */
export class PlannerAttachmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  uid!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PLANNER_ATTACHMENT_NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}

/** Body for `POST /planner/ideas`. `status` is not accepted — a new idea
 * always starts at `created`, matching what the panel used to stamp
 * client-side. */
export class CreatePlannerIdeaDto {
  @IsString()
  @Matches(DAY_PATTERN, { message: 'day must be formatted yyyy-mm-dd' })
  day!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PLANNER_IDEA_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLANNER_IDEA_BODY_MAX)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLANNER_IDEA_ATTACHMENTS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PlannerAttachmentDto)
  attachments?: PlannerAttachmentDto[];
}

/** Body for `PATCH /planner/ideas/:ideaId`. Every field is optional; the
 * status dropdown sends `status` alone, the (future) edit form sends the
 * text fields. `day` is included so an idea can be moved to another date
 * without a delete/recreate round-trip. */
export class UpdatePlannerIdeaDto {
  @IsOptional()
  @IsString()
  @Matches(DAY_PATTERN, { message: 'day must be formatted yyyy-mm-dd' })
  day?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(PLANNER_IDEA_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PLANNER_IDEA_BODY_MAX)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLANNER_IDEA_ATTACHMENTS_MAX)
  @ValidateNested({ each: true })
  @Type(() => PlannerAttachmentDto)
  attachments?: PlannerAttachmentDto[];

  @IsOptional()
  @IsIn(PLANNER_IDEA_STATUSES as readonly string[])
  status?: PlannerIdeaStatusValue;
}
