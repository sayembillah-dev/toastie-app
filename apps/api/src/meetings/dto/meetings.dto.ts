import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const THEME_MAX = 120;
const WORD_MAX = 40;
const WORD_TEXT_MAX = 240;

/** The classic English parts of speech, string-identical to the list the
 * Theme tab's dropdown offers. Empty string is accepted as "cleared" —
 * antd's `allowClear` sends the field back empty rather than omitting it. */
export const PARTS_OF_SPEECH = [
  'Noun',
  'Verb',
  'Adjective',
  'Adverb',
  'Pronoun',
  'Preposition',
  'Conjunction',
  'Interjection',
  'Determiner',
] as const;

/** The grammarian's word of the day. Sent whole rather than field-by-field:
 * the parts only make sense together, and a partial patch would leave a
 * meaning attached to a word that had since changed. */
export class WordOfTheDayDto {
  @IsString()
  @MaxLength(WORD_MAX)
  word!: string;

  @IsOptional()
  @IsIn([...PARTS_OF_SPEECH, ''])
  partOfSpeech?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORD_TEXT_MAX)
  meaning?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WORD_TEXT_MAX)
  example?: string;
}

/** Body for `POST /meetings`. A meeting is born a draft; the status field
 * lives on `UpdateMeetingDto` because Publish is a separate button. */
export class CreateMeetingDto {
  @IsInt()
  @Min(1)
  meetingNumber!: number;

  @IsISO8601()
  dateTime!: string;

  @IsString()
  @MaxLength(THEME_MAX)
  theme!: string;
}

/** Body for `PATCH /meetings/:meetingId` — the Save as Draft / Publish
 * buttons on the meeting page share this shape. */
export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  @MaxLength(THEME_MAX)
  theme?: string;

  @IsOptional()
  @IsString()
  status?: 'draft' | 'published';

  /** Omitted leaves the stored word alone; sending it with an empty `word`
   * clears the whole block, which is how the Theme tab removes one. */
  @IsOptional()
  @ValidateNested()
  @Type(() => WordOfTheDayDto)
  word?: WordOfTheDayDto;
}
