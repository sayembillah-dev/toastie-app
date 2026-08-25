import { Body, Controller, Get, NotFoundException, Param, Put, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

import { SaveMeetingRoleStateDto } from './dto/meetings.dto';
import { assertRoleStateKind, assertRoleStateSize } from './role-state';
import { type MeetingRoleStateWire, type WordOfTheDayWire } from './serializers';

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

/** Wire shape for `/public/meetings/:id/speakers/:speakerId` — backs the
 * anonymous evaluation form's header. Gated by the same share token as the
 * meeting lookup (not `published` status like the agenda endpoint below),
 * since a speech evaluation link is meant to work while the meeting is
 * still a draft. */
export interface PublicSpeakerWire {
  id: string;
  title: string;
  pathway: string | null;
  project: string | null;
  duration: number | null;
  speakerName: string;
  evaluatorName: string;
}

/** Wire shape for `/public/meetings/:id/roles/:role` — backs the public
 * Ah Counter/Timer/Grammarian pages' identity gate. Same (id, token) gate as
 * `getSpeaker` above. `name` is `''` when nobody is assigned to that role
 * yet — the client treats that the same as "no known name" (generic
 * "confirm who you are" prompt), not a 404, since the role page itself is
 * still valid before anyone's been assigned. */
export interface PublicRoleAssignmentWire {
  roleKey: string;
  name: string;
}

/** Wire shape for `/public/meetings/:id/roles/agenda-speakers` — backs the
 * public Ah Counter/Timer pages' "Take from agenda" seeding, mirroring what
 * `buildAgendaSpeakerSources` (client, `lib/meetings/agenda-speaker-sources.ts`)
 * computes from the authenticated `/members`, `/guests`, roles, and
 * prepared-speakers endpoints — none of which an anonymous caller can reach
 * (full roster with PII). This is the same computation done server-side
 * instead, gated by the meeting's share token, exposing only what those
 * tools actually need: a stable key, a display name, the role, and (for
 * prepared speakers) the project/pathway used to compute timing brackets. */
export interface PublicAgendaSpeakerSourceWire {
  agendaKey: string;
  name: string;
  role: 'speaker' | 'evaluator' | 'general-evaluator' | 'tt-evaluator';
  project: string | null;
  pathway: string | null;
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
  clubContactPhone: string | null;
  clubVenueMapUrl: string | null;
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

  /** Backs the evaluation form's header — same (id, token) gate as `get()`
   * above, plus confirming the speaker slot belongs to this meeting. */
  @Get(':meetingId/speakers/:speakerId')
  async getSpeaker(
    @Param('meetingId') meetingId: string,
    @Param('speakerId') speakerId: string,
    @Query('t') token: string | undefined,
  ): Promise<PublicSpeakerWire> {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: { clubId: true },
    });
    if (!meeting) {
      throw new NotFoundException('No meeting matches that share link');
    }

    const speaker = await this.prisma.meetingSpeaker.findFirst({
      where: { id: speakerId, clubId: meeting.clubId, meetingId },
      select: {
        id: true,
        title: true,
        pathway: true,
        project: true,
        duration: true,
        membership: { select: { firstName: true, lastName: true } },
        guest: { select: { firstName: true, lastName: true } },
        evaluatorMembership: { select: { firstName: true, lastName: true } },
        evaluatorGuest: { select: { firstName: true, lastName: true } },
      },
    });
    if (!speaker) {
      throw new NotFoundException('No speaker matches this meeting');
    }

    return {
      id: speaker.id,
      title: speaker.title,
      pathway: speaker.pathway,
      project: speaker.project,
      duration: speaker.duration,
      speakerName: fullName(speaker.membership ?? speaker.guest),
      evaluatorName: fullName(speaker.evaluatorMembership ?? speaker.evaluatorGuest),
    };
  }

  /** Backs the Ah Counter/Timer/Grammarian pages' identity gate — same
   * (id, token) gate as `getSpeaker`. `role` is the `RoleKind` slug
   * (`ah-counter`/`timer`/`grammarian`), which is string-identical to
   * `MeetingRoleAssignment.roleKey` for these roles (see `lib/meetings/roles.ts`
   * on the client). */
  @Get(':meetingId/roles/:role')
  async getRoleAssignment(
    @Param('meetingId') meetingId: string,
    @Param('role') role: string,
    @Query('t') token: string | undefined,
  ): Promise<PublicRoleAssignmentWire> {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: { clubId: true },
    });
    if (!meeting) {
      throw new NotFoundException('No meeting matches that share link');
    }

    const assignment = await this.prisma.meetingRoleAssignment.findFirst({
      where: { meetingId, clubId: meeting.clubId, roleKey: role },
      select: {
        roleKey: true,
        membership: { select: { firstName: true, lastName: true } },
        guest: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      roleKey: role,
      name: assignment ? fullName(assignment.membership ?? assignment.guest) : '',
    };
  }

  /** Backs the public Ah Counter/Timer "Take from agenda" button — same
   * (id, token) gate as `getSpeaker`/`getRoleAssignment`. Order and field
   * shape are chosen so `fromPublicAgendaSpeakerSources` on the client can
   * turn this straight into the same `AgendaSpeakerSource[]` the authenticated
   * tab builds from `buildAgendaSpeakerSources`, so both surfaces seed
   * identically off this same query. */
  @Get(':meetingId/roles/agenda-speakers')
  async getAgendaSpeakerSources(
    @Param('meetingId') meetingId: string,
    @Query('t') token: string | undefined,
  ): Promise<PublicAgendaSpeakerSourceWire[]> {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: { clubId: true },
    });
    if (!meeting) {
      throw new NotFoundException('No meeting matches that share link');
    }

    const [speakers, roleRows] = await Promise.all([
      this.prisma.meetingSpeaker.findMany({
        where: { clubId: meeting.clubId, meetingId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          project: true,
          pathway: true,
          membership: { select: { firstName: true, lastName: true } },
          guest: { select: { firstName: true, lastName: true } },
          evaluatorMembership: { select: { firstName: true, lastName: true } },
          evaluatorGuest: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.meetingRoleAssignment.findMany({
        where: {
          clubId: meeting.clubId,
          meetingId,
          roleKey: { in: ['general-evaluator', 'table-topic-evaluator'] },
        },
        select: {
          roleKey: true,
          membership: { select: { firstName: true, lastName: true } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const sources: PublicAgendaSpeakerSourceWire[] = [];

    for (const speaker of speakers) {
      const speakerName = fullName(speaker.membership ?? speaker.guest);
      if (speakerName) {
        sources.push({
          agendaKey: `speaker:${speaker.id}`,
          name: speakerName,
          role: 'speaker',
          project: speaker.project,
          pathway: speaker.pathway,
        });
      }
      const evaluatorName = fullName(speaker.evaluatorMembership ?? speaker.evaluatorGuest);
      if (evaluatorName) {
        sources.push({
          agendaKey: `speaker-evaluator:${speaker.id}`,
          name: evaluatorName,
          role: 'evaluator',
          project: null,
          pathway: null,
        });
      }
    }

    const generalEvaluator = roleRows.find((row) => row.roleKey === 'general-evaluator');
    if (generalEvaluator) {
      const name = fullName(generalEvaluator.membership ?? generalEvaluator.guest);
      if (name) {
        sources.push({
          agendaKey: 'role:general-evaluator',
          name,
          role: 'general-evaluator',
          project: null,
          pathway: null,
        });
      }
    }

    const ttEvaluator = roleRows.find((row) => row.roleKey === 'table-topic-evaluator');
    if (ttEvaluator) {
      const name = fullName(ttEvaluator.membership ?? ttEvaluator.guest);
      if (name) {
        sources.push({
          agendaKey: 'role:table-topic-evaluator',
          name,
          role: 'tt-evaluator',
          project: null,
          pathway: null,
        });
      }
    }

    return sources;
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
        club: { select: { name: true, contactPhone: true, venueMapUrl: true } },
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
      clubContactPhone: meeting.club.contactPhone,
      clubVenueMapUrl: meeting.club.venueMapUrl,
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

  /** Live role capture state for the share-link pages — same (id, token)
   * gate as `getSpeaker`/`getRoleAssignment`. The guest holding the Timer or
   * Ah-Counter link writes here; the in-app tab reads the same row via the
   * authenticated twin, which is what keeps the two surfaces in sync. The
   * blob is opaque to the server; last write wins. */
  @Get(':meetingId/role-state/:kind')
  async getRoleState(
    @Param('meetingId') meetingId: string,
    @Param('kind') kind: string,
    @Query('t') token: string | undefined,
  ): Promise<MeetingRoleStateWire> {
    assertRoleStateKind(kind);
    await this.loadMeetingByToken(meetingId, token);
    const row = await this.prisma.meetingRoleState.findUnique({
      where: { meetingId_kind: { meetingId, kind } },
    });
    return {
      kind,
      state: row?.state ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  @Put(':meetingId/role-state/:kind')
  async saveRoleState(
    @Param('meetingId') meetingId: string,
    @Param('kind') kind: string,
    @Query('t') token: string | undefined,
    @Body() dto: SaveMeetingRoleStateDto,
  ): Promise<MeetingRoleStateWire> {
    assertRoleStateKind(kind);
    assertRoleStateSize(dto.state);
    const meeting = await this.loadMeetingByToken(meetingId, token);
    const row = await this.prisma.meetingRoleState.upsert({
      where: { meetingId_kind: { meetingId, kind } },
      create: {
        clubId: meeting.clubId,
        meetingId,
        kind,
        state: dto.state as Prisma.InputJsonValue,
      },
      update: { state: dto.state as Prisma.InputJsonValue },
    });
    return { kind, state: row.state, updatedAt: row.updatedAt.toISOString() };
  }

  /** Shared (id, token) gate for the role-state routes — identical semantics
   * to the inline lookups above: wrong id or wrong token both 404. */
  private async loadMeetingByToken(
    meetingId: string,
    token: string | undefined,
  ): Promise<{ clubId: string }> {
    if (!token) {
      throw new NotFoundException('No meeting matches that share link');
    }
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: { clubId: true },
    });
    if (!meeting) {
      throw new NotFoundException('No meeting matches that share link');
    }
    return meeting;
  }
}
