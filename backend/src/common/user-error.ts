import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/**
 * An expected mistake made by the user in a form (wrong password, email already
 * used, invalid room code...). Answered with 200 and { ok: false, message }:
 * Chrome logs every 4xx response in the console, and the subject asks for a
 * console without errors. Real errors (bad token, missing rights, server
 * failure) keep their HTTP status code.
 */
export class UserError extends Error {}

@Catch(UserError)
export class UserErrorFilter implements ExceptionFilter {
  catch(error: UserError, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(200)
      .json({ ok: false, message: error.message });
  }
}
