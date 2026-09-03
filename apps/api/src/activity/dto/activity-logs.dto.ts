import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Query params for `GET /activity-logs` — cursor pagination plus the feed's
 * filters, all server-side so an infinite-scrolling client never has to hold
 * the whole log to filter it. */
export class ListActivityLogsQueryDto {
  /** Last log id from the previous page — Prisma cursor, skipped itself. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Filter to one actor (membership id) — the feed's member dropdown. */
  @IsOptional()
  @IsString()
  memberId?: string;

  /** One of the 8 activity categories; unknown values simply match nothing. */
  @IsOptional()
  @IsString()
  category?: string;

  /** ISO instant — the viewer-local start-of-day cutoff behind the time-range
   * filter. Computed client-side so "today" means the viewer's day, not the
   * server's. */
  @IsOptional()
  @IsISO8601()
  since?: string;

  /** Free-text search — matches the summary, or the actor's name (any
   * whitespace-separated token against first/last name). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
