import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const TABLE_TOPIC_TEXT_MAX = 400;

export class CreateTableTopicQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TABLE_TOPIC_TEXT_MAX)
  text!: string;
}

export class UpdateTableTopicQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TABLE_TOPIC_TEXT_MAX)
  text?: string;

  @IsOptional()
  @IsBoolean()
  asked?: boolean;
}
