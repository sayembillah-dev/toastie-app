import { TaskPriority } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TASK_TITLE_MAX = 120;
export const TASK_DESCRIPTION_MAX = 2000;
export const TASK_NOTE_MAX = 1000;
const TASK_MAX_ASSIGNEES = 20;

/** Body for `POST /tasks`. `assigneeMembershipIds` may be empty — an
 * officer can park an unassigned task — the service validates each id
 * belongs to the caller's club. */
export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TASK_TITLE_MAX)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsArray()
  @ArrayMaxSize(TASK_MAX_ASSIGNEES)
  @ArrayUnique()
  @IsString({ each: true })
  assigneeMembershipIds!: string[];
}

/** Body for `PATCH /tasks/:taskId`. Every field is optional — the service
 * decides whether the caller's role/ownership covers what's actually being
 * changed. Touching `title`/`description`/`priority`/`assigneeMembershipIds`
 * requires being the creator (or holding the wider club-scoped grant);
 * `done` alone can also come from any current assignee. */
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TASK_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TASK_MAX_ASSIGNEES)
  @ArrayUnique()
  @IsString({ each: true })
  assigneeMembershipIds?: string[];

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

/** Body for `POST /tasks/:taskId/notes`. */
export class CreateTaskNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TASK_NOTE_MAX)
  body!: string;
}
