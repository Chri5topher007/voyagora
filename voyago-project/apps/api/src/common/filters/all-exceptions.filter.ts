import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

// Ensures every error response (validation failures, thrown HttpExceptions,
// and genuinely unexpected crashes) comes back in the same shape, and that
// unexpected errors are logged server-side but never leak internals
// (stack traces, DB errors, etc.) to the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      let message = typeof body === 'string' ? body : (body as any).message || 'Request failed';
      // class-validator failures come back as an array of messages (one per
      // failed field) — join them into one readable string for the client.
      if (Array.isArray(message)) message = message.join('; ');
      response.status(status).json({
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Unknown/unexpected error: log full detail server-side, return a generic
    // message to the client so we never leak stack traces or DB internals.
    this.logger.error('Unhandled exception', exception instanceof Error ? exception.stack : String(exception));
    response.status(500).json({
      statusCode: 500,
      message: 'Something went wrong. Please try again.',
      timestamp: new Date().toISOString(),
    });
  }
}
