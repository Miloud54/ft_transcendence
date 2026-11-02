import { BadRequestException } from '@nestjs/common';
import { avatarFileFilter, UserController } from './user.controller';

describe('UserController avatar upload', () => {
  const userService = {
    updateAvatar: jest.fn(),
  };
  const presenceGateway = {};
  const controller = new UserController(
    userService as never,
    presenceGateway as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a request without a file with HTTP 400', () => {
    expect(() =>
      controller.uploadAvatar({ user: { userId: '42' } } as never, undefined),
    ).toThrow(BadRequestException);
    expect(userService.updateAvatar).not.toHaveBeenCalled();
  });

  it('rejects a non-image file with HTTP 400', () => {
    const callback = jest.fn();

    avatarFileFilter(
      {} as never,
      { mimetype: 'text/plain' } as Express.Multer.File,
      callback,
    );

    expect(callback).toHaveBeenCalledWith(
      expect.any(BadRequestException),
      false,
    );
  });

  it('keeps valid image uploads on the existing service path', () => {
    userService.updateAvatar.mockReturnValue({ user_id: '42' });

    const result = controller.uploadAvatar(
      { user: { userId: '42' } } as never,
      { filename: '42-avatar.png' } as Express.Multer.File,
    );

    expect(userService.updateAvatar).toHaveBeenCalledWith(
      '42',
      '42-avatar.png',
    );
    expect(result).toEqual({ user_id: '42' });
  });
});
