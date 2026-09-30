import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameModule } from 'src/game/game.module';

@Module({
  imports: [PrismaModule, GameModule],
  controllers: [RoomController],
  providers: [RoomService],
})
export class RoomModule {}
