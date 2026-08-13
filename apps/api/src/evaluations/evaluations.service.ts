import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Membership } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';
import {
  INLINE_MAX_BYTES,
  type SignedUpload,
  StorageService,
  SURFACE_RULES,
  stripCodecs,
} from '@/storage';

import type { SignEvaluationUploadDto, SubmitEvaluationDto } from './dto/evaluations.dto';
import { type EvaluationSubmissionWire, toEvaluationSubmissionWire } from './serializers';

/** Handles both the anonymous evaluation flow (`PublicEvaluationsController`,
 * gated by the meeting's share token) and the authenticated "what feedback
 * have I received" read (`EvaluationsController`, gated by the `evaluation`
 * permission). Kept in one service since both sides operate on the same
 * `EvaluationSubmission` table. */
@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** ------------------------------------------------------ public flow -- */

  async signPublicUpload(
    meetingId: string,
    speakerId: string,
    token: string | undefined,
    dto: SignEvaluationUploadDto,
  ): Promise<SignedUpload> {
    const { clubId } = await this.requirePublicSpeaker(meetingId, speakerId, token);

    const rule = SURFACE_RULES[dto.surface];
    const mimeType = stripCodecs(dto.mimeType);
    if (!rule.mimeTypes.includes(mimeType)) {
      throw new BadRequestException(`"${dto.mimeType}" is not an accepted file type`);
    }
    const limit = this.storage.isS3 ? rule.maxBytes : Math.min(rule.maxBytes, INLINE_MAX_BYTES);
    if (dto.sizeBytes > limit) {
      const mb = Math.floor(limit / (1024 * 1024));
      throw new BadRequestException(`File is too large — the limit is ${mb} MB`);
    }

    return this.storage.signUpload({ surface: dto.surface, scopeId: clubId, mimeType });
  }

  async submitPublicEvaluation(
    meetingId: string,
    speakerId: string,
    token: string | undefined,
    dto: SubmitEvaluationDto,
  ): Promise<{ id: string }> {
    const { clubId } = await this.requirePublicSpeaker(meetingId, speakerId, token);

    const imageKeys = dto.imageKeys ?? [];
    const hasContent = !!dto.text?.trim() || !!dto.audioKey || imageKeys.length > 0;
    if (!hasContent) {
      throw new BadRequestException('Add at least one piece of feedback before submitting');
    }

    if (dto.audioKey) this.storage.assertOwnedKey(dto.audioKey, 'evaluationAudio', clubId);
    for (const key of imageKeys) this.storage.assertOwnedKey(key, 'evaluationImage', clubId);

    const row = await this.prisma.evaluationSubmission.create({
      data: {
        clubId,
        meetingId,
        meetingSpeakerId: speakerId,
        evaluatorName: dto.evaluatorName.trim() || 'Anonymous',
        isAssignedEvaluator: dto.isAssignedEvaluator,
        text: dto.text?.trim() || null,
        audioKey: dto.audioKey ?? null,
        audioMimeType: dto.audioKey ? (dto.audioMimeType ?? null) : null,
        audioDurationSec: dto.audioKey ? (dto.audioDurationSec ?? null) : null,
        imageKeys,
      },
      select: { id: true },
    });
    return row;
  }

  /** Looks up (meeting id, token) together — same opacity as
   * `PublicMeetingsController.get`: a wrong id and a wrong token both 404
   * identically, so a caller can't distinguish "no such meeting" from "right
   * meeting, wrong token". Also confirms the speaker slot belongs to that
   * meeting, so a stale/foreign `speakerId` can't be paired with a
   * still-valid token from a different speaker's link. */
  private async requirePublicSpeaker(
    meetingId: string,
    speakerId: string,
    token: string | undefined,
  ): Promise<{ clubId: string }> {
    if (!token) throw new NotFoundException('No meeting matches that share link');

    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, shareToken: token },
      select: { clubId: true },
    });
    if (!meeting) throw new NotFoundException('No meeting matches that share link');

    const speaker = await this.prisma.meetingSpeaker.findFirst({
      where: { id: speakerId, clubId: meeting.clubId, meetingId },
      select: { id: true },
    });
    if (!speaker) throw new NotFoundException('No meeting matches that share link');

    return { clubId: meeting.clubId };
  }

  /** ------------------------------------------------------- authed read -- */

  async listReceivedForMember(
    subject: PermissionSubject,
    memberId: string,
  ): Promise<EvaluationSubmissionWire[]> {
    const member = await this.loadMember(memberId);
    if (
      !can(subject, 'read', 'evaluation', { clubId: member.clubId, ownerMembershipId: member.id })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'evaluation',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }

    const rows = await this.prisma.evaluationSubmission.findMany({
      where: { clubId: member.clubId, meetingSpeaker: { membershipId: member.id } },
      include: {
        meeting: { select: { meetingNumber: true } },
        meetingSpeaker: { select: { title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
    return Promise.all(rows.map((row) => toEvaluationSubmissionWire(row, this.storage)));
  }

  private async loadMember(memberId: string): Promise<Membership> {
    const row = await this.prisma.membership.findUnique({ where: { id: memberId } });
    if (!row) throw new NotFoundException(`No member with id "${memberId}"`);
    return row;
  }
}
