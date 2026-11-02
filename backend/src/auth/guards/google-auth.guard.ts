import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // When the user cancels on the provider page (?error=access_denied) or the
  // provider fails, let the callback redirect to the login page instead of
  // answering a raw 401.
  handleRequest<TUser>(err: unknown, user: TUser | false): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
