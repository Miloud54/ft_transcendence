import { IsByteLength, IsString, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_MESSAGE,
} from '../../auth/password.rule';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_MESSAGE })
  newPassword: string;
}
