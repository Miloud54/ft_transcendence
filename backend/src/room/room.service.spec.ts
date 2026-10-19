import { Test, TestingModule } from '@nestjs/testing';
import { RoomService } from './room.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GameService } from 'src/game/game.service';
import { UserService } from 'src/user/user.service';

jest.mock('src/game/game.service', () => ({
  GameService: class MockGameService {},
}));

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(async () => {
    const { GameService: MockGameService } =
      jest.requireMock('src/game/game.service');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: MockGameService,
          useValue: {},
        },
        {
          provide: UserService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
