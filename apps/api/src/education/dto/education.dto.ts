import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const NOTE_MAX = 240;

/** Body for `POST /members/:memberId/pathway`. Level is 1–5; project is
 * the specific project name inside the pathway. */
export class StartPathwayDto {
  @IsString()
  @MinLength(1)
  pathway!: string;

  @IsString()
  @MinLength(1)
  project!: string;

  @IsInt()
  @Min(1)
  level!: 1 | 2 | 3 | 4 | 5;
}

/** Body for `POST /members/:memberId/speech-slot-requests`. */
export class CreateSpeechSlotRequestDto {
  @IsString()
  @MinLength(1)
  meetingId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  projectName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  note?: string;
}
