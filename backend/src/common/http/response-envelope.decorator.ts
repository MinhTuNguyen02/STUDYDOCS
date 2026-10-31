import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const SKIP_RESPONSE_ENVELOPE = 'skipResponseEnvelope';
export const PUBLIC_CACHE_SECONDS = 'publicCacheSeconds';

export function SkipResponseEnvelope() {
  return applyDecorators(
    SetMetadata(SKIP_RESPONSE_ENVELOPE, true),
    ApiExtension('x-response-envelope', false)
  );
}

export function PublicCache(seconds = 300) {
  return SetMetadata(PUBLIC_CACHE_SECONDS, seconds);
}
