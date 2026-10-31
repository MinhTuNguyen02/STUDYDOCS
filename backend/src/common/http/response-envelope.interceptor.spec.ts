import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { PUBLIC_CACHE_SECONDS, SKIP_RESPONSE_ENVELOPE } from './response-envelope.decorator';

describe('ResponseEnvelopeInterceptor', () => {
  function setup(metadata: Record<string, unknown> = {}, ifNoneMatch?: string) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => metadata[key])
    };
    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
      status: jest.fn(function (this: { statusCode: number }, code: number) {
        this.statusCode = code;
        return this;
      })
    };
    const request = {
      method: 'GET',
      header: jest.fn((name: string) => (name === 'if-none-match' ? ifNoneMatch : undefined))
    };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response })
    };
    return {
      interceptor: new ResponseEnvelopeInterceptor(reflector as never),
      context,
      response
    };
  }

  it('wraps a regular object and keeps temporary compatibility aliases', async () => {
    const { interceptor, context } = setup();
    const result = await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of({ id: 1 }) })
    );
    expect(result).toEqual({ success: true, data: { id: 1 }, id: 1 });
  });

  it('preserves pagination metadata at the envelope level', async () => {
    const { interceptor, context } = setup();
    const result = await firstValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of({ data: [{ id: 1 }], meta: { page: 1, limit: 20, total: 1 } })
      })
    );
    expect(result).toEqual({
      success: true,
      data: [{ id: 1 }],
      meta: { page: 1, limit: 20, total: 1 }
    });
  });

  it('sets public cache headers and a deterministic ETag', async () => {
    const { interceptor, context, response } = setup({ [PUBLIC_CACHE_SECONDS]: 60 });
    await firstValueFrom(interceptor.intercept(context as never, { handle: () => of(['tag']) }));
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120'
    );
    expect(response.setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^".+"$/));
  });

  it('does not wrap explicitly excluded external protocols', async () => {
    const { interceptor, context } = setup({ [SKIP_RESPONSE_ENVELOPE]: true });
    const result = await firstValueFrom(
      interceptor.intercept(context as never, { handle: () => of({ RspCode: '00' }) })
    );
    expect(result).toEqual({ RspCode: '00' });
  });
});
