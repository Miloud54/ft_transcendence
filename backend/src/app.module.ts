import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { RoomModule } from './room/room.module';
import { GameModule } from './game/game.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, HealthModule, RoomModule, GameModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
