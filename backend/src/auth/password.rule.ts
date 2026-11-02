/**
 * bcrypt only uses the first 72 bytes of a password: anything after is ignored,
 * so a longer password could be accepted with only its first 72 bytes.
 * Longer passwords are therefore refused.
 */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MAX_MESSAGE = `Password is too long (${PASSWORD_MAX_BYTES} characters maximum)`;

export function isPasswordTooLong(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES;
}
