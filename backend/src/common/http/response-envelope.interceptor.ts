import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { Observable, map } from 'rxjs';
import {
  PUBLIC_CACHE_SECONDS,
  SKIP_RESPONSE_ENVELOPE
} from './response-envelope.decorator';

type RecordValue = Record<string, unknown>;

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_ENVELOPE, [
      context.getHandler(),
      context.getClass()
    ]);
    if (skip || context.getType() !== 'http') return next.handle();

    const cacheSeconds = this.reflector.getAllAndOverride<number>(PUBLIC_CACHE_SECONDS, [
      context.getHandler(),
      context.getClass()
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((payload: unknown) => {
        const envelope = this.wrap(payload);
        if (request.method === 'GET' && cacheSeconds && response.statusCode < 300) {
          const etag = `"${createHash('sha256').update(JSON.stringify(envelope)).digest('base64url')}"`;
          response.setHeader(
            'Cache-Control',
            `public, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`
          );
          response.setHeader('ETag', etag);
          if (request.header('if-none-match') === etag) {
            response.status(304);
            return undefined;
          }
        }
        return envelope;
      })
    );
  }

  private wrap(payload: unknown): RecordValue {
    if (this.isDataPayload(payload)) {
      const { data, ...rest } = payload;
      return { success: true, data, ...rest };
    }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // Keep top-level aliases during the API transition while every client moves to `data`.
      return { ...(payload as RecordValue), success: true, data: payload };
    }
    return { success: true, data: payload ?? null };
  }

  private isDataPayload(payload: unknown): payload is RecordValue & {
    data: unknown;
  } {
    return Boolean(
      payload &&
        typeof payload === 'object' &&
        'data' in payload
    );
  }
}
