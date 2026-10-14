import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PedantixEngineModule } from 'src/pedantix-engine/pedantix-engine.module';
import { AuthModule } from 'src/auth/auth.module';
import { GameGateway } from './game.gateway';

@Module({
  imports: [PrismaModule, PedantixEngineModule, AuthModule],
  controllers: [GameController],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
