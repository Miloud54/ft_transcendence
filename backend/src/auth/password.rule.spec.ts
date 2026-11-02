import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './dto/register.dto';
import { isPasswordTooLong, PASSWORD_MAX_BYTES } from './password.rule';

describe('password length rule (bcrypt only uses 72 bytes)', () => {
  const register = (password: string) =>
    validateSync(
      plainToInstance(RegisterDto, {
        username: 'alice',
        email: 'alice@mail.com',
        password,
      }),
    );

  it('accepts a 72-character password and refuses an 80-character one', () => {
    expect(register('a'.repeat(PASSWORD_MAX_BYTES))).toHaveLength(0);
    expect(register('a'.repeat(80))).toHaveLength(1);
  });

  it('counts bytes, not characters (accented letters take 2 bytes)', () => {
    expect(isPasswordTooLong('é'.repeat(36))).toBe(false);
    expect(isPasswordTooLong('é'.repeat(37))).toBe(true);
  });
});
