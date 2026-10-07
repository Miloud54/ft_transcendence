import { Module } from '@nestjs/common';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GameModule } from 'src/game/game.module';
import { AuthModule } from 'src/auth/auth.module';
import { RoomGateway } from './room.gateway';

@Module({
  imports: [PrismaModule, GameModule, AuthModule],
  controllers: [RoomController],
  providers: [RoomService, RoomGateway],
  exports: [RoomGateway],
})
export class RoomModule {}
