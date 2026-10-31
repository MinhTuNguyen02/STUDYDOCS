import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { requestId?: string }).requestId;

    let status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let message: unknown =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping: Record<string, { status: number; message: string }> = {
        P2002: { status: HttpStatus.CONFLICT, message: 'Dữ liệu đã tồn tại.' },
        P2003: { status: HttpStatus.CONFLICT, message: 'Dữ liệu đang được tham chiếu.' },
        P2025: { status: HttpStatus.NOT_FOUND, message: 'Không tìm thấy dữ liệu.' },
        P2034: { status: HttpStatus.CONFLICT, message: 'Xung đột giao dịch, vui lòng thử lại.' }
      };
      const mapped = mapping[exception.code];
      if (mapped) {
        status = mapped.status;
        message = mapped.message;
      }
    }

    const responseMessage =
      typeof message === 'string'
        ? message
        : message && typeof message === 'object' && 'message' in message
          ? (message as { message: unknown }).message
          : message;

    // In production, we don't want to expose stack traces or raw database error details.
    const responseDetails =
      message && typeof message === 'object'
        ? Object.fromEntries(
            Object.entries(message).filter(([key]) => !['statusCode', 'message', 'error'].includes(key))
          )
        : {};
    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      requestId,
      message: responseMessage,
      ...responseDetails
    };

    // We can also log detailed exception to console/logger
    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${requestId || 'no-request-id'} ${request.method} ${request.path}`, stack);
    }

    response.status(status).json(errorResponse);
  }
}
