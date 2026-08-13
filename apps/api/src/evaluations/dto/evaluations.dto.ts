import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const EVALUATION_UPLOAD_SURFACES = ['evaluationAudio', 'evaluationImage'] as const;
export type EvaluationUploadSurface = (typeof EVALUATION_UPLOAD_SURFACES)[number];

export const MAX_EVALUATION_IMAGES = 8;
const EVALUATOR_NAME_MAX = 120;
const TEXT_MAX = 4000;

/** Body for `POST /public/meetings/:meetingId/speakers/:speakerId/evaluations/sign`. */
export class SignEvaluationUploadDto {
  @IsIn(EVALUATION_UPLOAD_SURFACES)
  surface!: EvaluationUploadSurface;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

/** Body for `POST /public/meetings/:meetingId/speakers/:speakerId/evaluations`. Every
 * content field is optional on its own — the client gates Submit on at least
 * one being present (`hasContent` in `evaluate-page.tsx`), and the service
 * re-checks the same thing server-side. */
export class SubmitEvaluationDto {
  @IsString()
  @MaxLength(EVALUATOR_NAME_MAX)
  evaluatorName!: string;

  @IsBoolean()
  isAssignedEvaluator!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsString()
  audioKey?: string;

  @IsOptional()
  @IsString()
  audioMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60 * 60)
  audioDurationSec?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_EVALUATION_IMAGES)
  @IsString({ each: true })
  imageKeys?: string[];
}
