import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from './game.service';

jest.mock('./game.service', () => ({
  GameService: class MockGameService {},
}));

jest.mock('src/auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

describe('GameController', () => {
  let controller: GameController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        {
          provide: GameService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
