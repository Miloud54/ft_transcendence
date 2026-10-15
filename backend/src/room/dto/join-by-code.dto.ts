import { IsString, Length } from 'class-validator';

export class JoinByCodeDto {
  @IsString()
  @Length(4, 10)
  code: string;
}
