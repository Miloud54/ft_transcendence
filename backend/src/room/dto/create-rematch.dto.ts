import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Max, Min } from 'class-validator';

export class CreateRematchDto {
  @Type(() => Number)
  @IsInt()
  @Min(2)
  minPlayers: number;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(6)
  maxPlayers: number;

  @IsArray()
  @IsString({ each: true })
  playerIds: string[];
}
