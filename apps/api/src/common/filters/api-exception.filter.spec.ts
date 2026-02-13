import {
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

// Silence logger output during tests
Logger.overrideLogger([]);

function createMockHost(reqOverrides: Record<string, unknown> = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const req = {
    requestId: 'test-rid-123',
    method: 'POST',
    path: '/api/v1/auth/login',
    user: undefined,
    __startTime: Date.now(),
    ...reqOverrides,
  };
  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, req };
}

afterAll(() => {
  Logger.overrideLogger(['log', 'warn', 'error']);
});

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  it('should return RATE_LIMITED code for 429', () => {
    const { host, status, json } = createMockHost();
    const exception = new HttpException(
      'Too many requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 429,
        code: 'RATE_LIMITED',
        requestId: 'test-rid-123',
        detail: 'Too many requests',
      }),
    );
  });

  it('should return REVISION_CONFLICT code for known 409', () => {
    const { host, json } = createMockHost();
    const exception = new HttpException(
      { message: 'REVISION_CONFLICT', statusCode: 409 },
      HttpStatus.CONFLICT,
    );

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        code: 'REVISION_CONFLICT',
      }),
    );
  });

  it('should include requestId in every error response', () => {
    const { host, json } = createMockHost({ requestId: 'rid-abc' });
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'rid-abc' }),
    );
  });

  it('should return INTERNAL for unhandled exceptions', () => {
    const { host, status, json } = createMockHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
        code: 'INTERNAL',
        requestId: 'test-rid-123',
      }),
    );
  });
});
