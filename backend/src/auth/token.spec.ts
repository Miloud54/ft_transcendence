import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('access and refresh tokens cannot be swapped', () => {
  process.env.JWT_SECRET = 'test-secret';
  const jwt = new JwtService({ secret: 'test-secret' });
  const auth = new AuthService({} as never, jwt);
  const strategy = new JwtStrategy();
  const user = { sub: '1', email: 'alice@mail.com' };

  it('the API accepts an access token', () => {
    expect(strategy.validate({ ...user, type: 'access' })).toEqual({
      userId: '1',
      email: 'alice@mail.com',
    });
  });

  it('the API refuses a refresh token used as an access token', () => {
    expect(() => strategy.validate({ ...user, type: 'refresh' })).toThrow(
      UnauthorizedException,
    );
  });

  it('refresh gives a new access token from a refresh token', () => {
    const refreshToken = jwt.sign({ ...user, type: 'refresh' });
    const { accessToken } = auth.refresh(refreshToken);
    expect(jwt.verify<{ type: string }>(accessToken).type).toBe('access');
  });

  it('refresh refuses an access token', () => {
    const accessToken = jwt.sign({ ...user, type: 'access' });
    expect(() => auth.refresh(accessToken)).toThrow(UnauthorizedException);
  });
});
