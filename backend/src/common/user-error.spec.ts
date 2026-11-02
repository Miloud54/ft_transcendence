import { ArgumentsHost } from '@nestjs/common';
import { UserError, UserErrorFilter } from './user-error';

describe('UserErrorFilter', () => {
  it('answers 200 with ok: false so the browser console stays clean', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new UserErrorFilter().catch(new UserError('Invalid room code'), host);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      ok: false,
      message: 'Invalid room code',
    });
  });
});
