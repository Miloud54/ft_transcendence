import {
  IsByteLength,
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  USERNAME_PATTERN,
  USERNAME_PATTERN_MESSAGE,
} from '../../user/username.rule';
import { PASSWORD_MAX_BYTES, PASSWORD_MAX_MESSAGE } from '../password.rule';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(USERNAME_PATTERN, { message: USERNAME_PATTERN_MESSAGE })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_MESSAGE })
  password: string;
}
