import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

/** Wire shape returned by `/public/meetings/:id` — a **minimal** projection.
 * Anonymous callers only see what the share pages actually render: the
 * meeting header (number, date, theme) and the containing club's name. No
 * roster, no emails, no membership ids. */
export interface PublicMeetingWire {
  id: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  clubName: string;
}

/** Public share endpoint — anonymous, gated by an opaque `shareToken`.
 *
 * The token is the credential. A bare meeting id would be a data leak (ids
 * are guessable / observable in the authed API); the token makes each
 * share link a one-off capability the meeting organiser can revoke by
 * rotating the token on the underlying row.
 *
 * `@Public()` skips both `JwtAuthGuard` and `ContextGuard`, so no session
 * or `X-Toastly-Context` is required. `routed-base-query` on the client
 * classifies `/public/*` and drops `Authorization` for the same reason —
 * a leaked link works from a browser with no login. */
@Public()
@Controller('public/meetings')
export class PublicMeetingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':meetingId')
  async get(
    @Param('meetingId') meetingId: string,
    @Query('t') token: string | undefined,
  ): Promise<PublicMeetingWire> {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    // Look up on (id, token) together — never on id alone. Wrong id or
    // wrong token both fall out as the same 404, so an attacker can't tell
    // "meeting exists, wrong token" from "no such meeting".
    const row = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: {
        id: true,
        meetingNumber: true,
        dateTime: true,
        theme: true,
        club: { select: { name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('No meeting matches that share link');
    }
    return {
      id: row.id,
      meetingNumber: row.meetingNumber,
      dateTime: row.dateTime.toISOString(),
      theme: row.theme,
      clubName: row.club.name,
    };
  }
}
