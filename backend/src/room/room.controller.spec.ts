import { Test, TestingModule } from '@nestjs/testing';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { RoomGateway } from './room.gateway';
import { PresenceGateway } from 'src/user/presence.gateway';

jest.mock('./room.service', () => ({
  RoomService: class MockRoomService {},
}));

jest.mock('./room.gateway', () => ({
  RoomGateway: class MockRoomGateway {},
}));

jest.mock('src/user/presence.gateway', () => ({
  PresenceGateway: class MockPresenceGateway {},
}));

jest.mock('src/auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class MockJwtAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

describe('RoomController', () => {
  let controller: RoomController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        { provide: RoomService, useValue: {} },
        { provide: RoomGateway, useValue: {} },
        { provide: PresenceGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get<RoomController>(RoomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
