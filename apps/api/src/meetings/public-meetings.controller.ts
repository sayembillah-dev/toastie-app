import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

import { type WordOfTheDayWire } from './serializers';

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

export interface PublicAgendaRoleWire {
  roleKey: string;
  name: string;
}

export interface PublicAgendaSpeakerWire {
  order: number;
  title: string;
  duration: number | null;
  pathway: string | null;
  project: string | null;
  speakerName: string;
  evaluatorName: string;
}

/** Wire shape for `/public/meetings/:id/agenda` — the published run-of-show,
 * with every role/speaker slot already resolved to a display name. Unlike
 * `PublicMeetingWire` this is gated by `status === 'published'` rather than
 * a share token: once a meeting is published it is the version the whole
 * club (and anyone with the link) is meant to see. */
export interface PublicMeetingAgendaWire {
  id: string;
  meetingNumber: number;
  dateTime: string;
  theme: string;
  clubName: string;
  word?: WordOfTheDayWire;
  roles: PublicAgendaRoleWire[];
  speakers: PublicAgendaSpeakerWire[];
}

type NamedPerson = { firstName: string; lastName: string } | null | undefined;

function fullName(person: NamedPerson): string {
  return person ? `${person.firstName} ${person.lastName}` : '';
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

  /** Public agenda endpoint — anonymous, gated by `status === 'published'`
   * rather than a share token. A meeting id alone is enough once it's
   * published; a draft meeting 404s the same as a meeting that doesn't
   * exist, so an unpublished agenda can't be discovered by guessing ids. */
  @Get(':meetingId/agenda')
  async getAgenda(@Param('meetingId') meetingId: string): Promise<PublicMeetingAgendaWire> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        meetingNumber: true,
        dateTime: true,
        theme: true,
        status: true,
        word: true,
        wordPartOfSpeech: true,
        wordMeaning: true,
        wordExample: true,
        club: { select: { name: true } },
        roleAssignments: {
          select: {
            roleKey: true,
            membership: { select: { firstName: true, lastName: true } },
            guest: { select: { firstName: true, lastName: true } },
          },
        },
        speakers: {
          orderBy: { order: 'asc' },
          select: {
            order: true,
            title: true,
            duration: true,
            pathway: true,
            project: true,
            membership: { select: { firstName: true, lastName: true } },
            guest: { select: { firstName: true, lastName: true } },
            evaluatorMembership: { select: { firstName: true, lastName: true } },
            evaluatorGuest: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (meeting?.status !== 'published') {
      throw new NotFoundException('No published agenda for this meeting');
    }

    const wire: PublicMeetingAgendaWire = {
      id: meeting.id,
      meetingNumber: meeting.meetingNumber,
      dateTime: meeting.dateTime.toISOString(),
      theme: meeting.theme,
      clubName: meeting.club.name,
      roles: meeting.roleAssignments
        .map((row) => ({ roleKey: row.roleKey, name: fullName(row.membership ?? row.guest) }))
        .filter((role) => role.name),
      speakers: meeting.speakers.map((speaker) => ({
        order: speaker.order,
        title: speaker.title,
        duration: speaker.duration,
        pathway: speaker.pathway,
        project: speaker.project,
        speakerName: fullName(speaker.membership ?? speaker.guest),
        evaluatorName: fullName(speaker.evaluatorMembership ?? speaker.evaluatorGuest),
      })),
    };
    if (meeting.word) {
      wire.word = {
        word: meeting.word,
        meaning: meeting.wordMeaning ?? '',
        example: meeting.wordExample ?? '',
      };
      if (meeting.wordPartOfSpeech) wire.word.partOfSpeech = meeting.wordPartOfSpeech;
    }
    return wire;
  }
}
