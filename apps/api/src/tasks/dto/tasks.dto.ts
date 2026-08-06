import { IsBoolean } from 'class-validator';

/** Body for `PATCH /tasks/:taskId`. Toggling done is the only edit the Me
 * page needs — assignment itself happens elsewhere. */
export class UpdateTaskDto {
  @IsBoolean()
  done!: boolean;
}
