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
    const { RoomService: MockRoomService } =
      jest.requireMock('./room.service');
    const { RoomGateway: MockRoomGateway } =
      jest.requireMock('./room.gateway');
    const { PresenceGateway: MockPresenceGateway } =
      jest.requireMock('src/user/presence.gateway');

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        { provide: MockRoomService, useValue: {} },
        { provide: MockRoomGateway, useValue: {} },
        { provide: MockPresenceGateway, useValue: {} },
      ],
    }).compile();

    controller = module.get<RoomController>(RoomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
