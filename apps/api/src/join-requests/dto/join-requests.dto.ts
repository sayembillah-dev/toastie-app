import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const MESSAGE_MAX = 500;

/** Body for `POST /join-requests`. `clubId` is required — a signed-up user
 * (no membership yet) can't have it inferred from the request context. */
export class CreateJoinRequestDto {
  @IsString()
  @MinLength(1)
  clubId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MESSAGE_MAX)
  message?: string;
}
