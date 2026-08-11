/** A planner idea is one note pinned to one day on the Library › Planner
 * calendar. The Planner tab reads and writes exclusively through the
 * `/planner/ideas` endpoints keyed off this shape. */

export const PLANNER_IDEA_TITLE_MAX = 200;
export const PLANNER_IDEA_BODY_MAX = 5000;
/** Mirrors `ArrayMaxSize` on the API DTO so the form can stop the user
 * before the request round-trips into a 400. */
export const PLANNER_IDEA_ATTACHMENTS_MAX = 20;

export type IdeaStatus = 'created' | 'drafted' | 'published';

/** Ordered so the status Select reads as a progression: fresh → in progress
 * → shipped. */
export const IDEA_STATUS_ORDER: IdeaStatus[] = ['created', 'drafted', 'published'];

/** One file pinned to an idea.
 *
 * Read and write shapes differ, which is why both fields are optional. The
 * API returns `url` — a signed, time-limited download link — and accepts
 * `key`, the S3 object it was minted from. Ideas saved before attachments
 * carried real bytes have neither: they recorded a filename and dropped the
 * file, so they render as plain text rather than a link. */
export interface IdeaAttachment {
  uid: string;
  name: string;
  /** Present on responses. Never sent back — it expires. */
  url?: string;
  /** Present on requests. Comes from `uploadFile`. */
  key?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface PlannerIdea {
  id: string;
  /** Tenant boundary — the club this idea belongs to. */
  clubId: string;
  /** yyyy-mm-dd — the calendar cell this idea sits in. */
  day: string;
  title: string;
  body: string;
  attachments: IdeaAttachment[];
  status: IdeaStatus;
  /** ISO datetime the idea was added. Drives the within-day ordering. */
  createdAt: string;
  /** Present only once the idea has been edited. */
  updatedAt?: string;
}

export interface CreatePlannerIdeaInput {
  day: string;
  title: string;
  body?: string;
  attachments?: IdeaAttachment[];
}

export interface UpdatePlannerIdeaInput {
  day?: string;
  title?: string;
  body?: string;
  attachments?: IdeaAttachment[];
  status?: IdeaStatus;
}

/** Buckets a flat month of ideas by day so the calendar can render a cell
 * marker without scanning the whole list per cell. */
export function groupIdeasByDay(ideas: readonly PlannerIdea[]): Record<string, PlannerIdea[]> {
  const byDay: Record<string, PlannerIdea[]> = {};
  for (const idea of ideas) {
    const bucket = byDay[idea.day] ?? [];
    bucket.push(idea);
    byDay[idea.day] = bucket;
  }
  return byDay;
}
