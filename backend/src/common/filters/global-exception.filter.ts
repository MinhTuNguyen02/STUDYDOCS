import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { requestId?: string }).requestId;

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    // In production, we don't want to expose stack traces or raw database error details.
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId,
      message: typeof message === 'string' ? message : (message as any).message || message
    };

    // We can also log detailed exception to console/logger
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${requestId || 'no-request-id'} ${request.method} ${request.path}`, stack);
    }

    response.status(status).json(errorResponse);
  }
}
