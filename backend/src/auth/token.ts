/**
 * Access and refresh tokens are signed with the same secret: the "type" claim
 * is what tells them apart, so a refresh token (7 days) can never be used as an
 * access token (1 day), and an access token can never be used to refresh.
 */
export type TokenType = 'access' | 'refresh';

export type TokenPayload = { sub: string; email: string; type: TokenType };

export function isTokenOfType(
  payload: { type?: unknown },
  type: TokenType,
): boolean {
  return payload.type === type;
}
