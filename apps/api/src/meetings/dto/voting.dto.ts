import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const VOTE_NAME_MAX = 120;
/** Generous head-room over the ~30 people a meeting ever puts up for one
 * award — the cap exists so a malformed body can't park an unbounded list. */
export const VOTE_CANDIDATES_MAX = 100;

/** One entry in the Voting tab's per-category editor. `membershipId` /
 * `guestId` are optional roster links (at most one set); the service
 * re-validates them against the club before trusting them. */
export class VoteCandidateInputDto {
  @IsString()
  @MaxLength(VOTE_NAME_MAX)
  name!: string;

  @IsOptional()
  @IsString()
  membershipId?: string;

  @IsOptional()
  @IsString()
  guestId?: string;
}

/** Body for `PUT /meetings/:meetingId/vote/candidates/:category` — replaces
 * the category's whole candidate list. */
export class SetVoteCandidatesDto {
  @IsArray()
  @ArrayMaxSize(VOTE_CANDIDATES_MAX)
  @ValidateNested({ each: true })
  @Type(() => VoteCandidateInputDto)
  candidates!: VoteCandidateInputDto[];
}

/** Body for `POST /public/meetings/:meetingId/vote`. The voter key is the
 * browser-generated random id stored in the voter's localStorage — it
 * dedupes repeat submissions from one device (upsert) without identifying a
 * person. `picks` maps category → candidate id; unknown keys and ids are
 * stripped by the service, and at least one valid pick must survive. */
export class SubmitPublicVoteDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  voterKey!: string;

  @IsObject()
  picks!: Record<string, unknown>;
}
