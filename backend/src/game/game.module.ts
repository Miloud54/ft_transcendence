import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PedantixEngineModule } from 'src/pedantix-engine/pedantix-engine.module';

@Module({
  imports: [PrismaModule, PedantixEngineModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
