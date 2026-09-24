import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CreateRoomDto {
    @Type(() => Number)
    @IsInt()
    @Min(2)
    minPlayers: number;

    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(6)
    maxPlayers: number;
}