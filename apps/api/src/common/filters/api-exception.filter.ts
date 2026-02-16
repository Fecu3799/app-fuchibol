import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: unknown;
  requestId: string;
}

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

/** Known domain error codes sent as ConflictException message strings. */
const DOMAIN_CONFLICT_CODES = new Set([
  'REVISION_CONFLICT',
  'MATCH_LOCKED',
  'MATCH_CANCELLED',
  'IDEMPOTENCY_KEY_REUSE',
  'SELF_INVITE',
  'ALREADY_PARTICIPANT',
]);

/** Known domain error codes sent as NotFoundException message strings. */
const DOMAIN_NOT_FOUND_CODES = new Set(['USER_NOT_FOUND']);

function resolveCode(status: number, response: unknown): string {
  if (typeof response === 'object' && response !== null) {
    const msg = (response as Record<string, unknown>).message;
    if (typeof msg === 'string') {
      if (status === 409) {
        if (DOMAIN_CONFLICT_CODES.has(msg)) return msg;
        if (msg.startsWith('CAPACITY_BELOW_CONFIRMED'))
          return 'CAPACITY_BELOW_CONFIRMED';
      }
      if (status === 404 && DOMAIN_NOT_FOUND_CODES.has(msg)) return msg;
    }
  }
  return STATUS_CODE_MAP[status] ?? 'INTERNAL';
}

function resolveDetail(response: unknown): string | undefined {
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null) {
    const r = response as Record<string, unknown>;
    const msg = r.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join('; ');
  }
  return undefined;
}

function resolveErrors(status: number, response: unknown): unknown {
  if (status !== 422) return undefined;
  if (typeof response === 'object' && response !== null) {
    const msg = (response as Record<string, unknown>).message;
    if (Array.isArray(msg)) return msg;
  }
  return undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = req.requestId ?? '-';
    let status: number;
    let response: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      response = exception.getResponse();
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      response = { message: 'Internal server error' };
      this.logger.error(
        `Unhandled exception rid=${requestId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const code = resolveCode(status, response);
    const detail = resolveDetail(response);
    const errors = resolveErrors(status, response);

    const body: ProblemDetails = {
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      code,
      requestId,
    };
    if (detail) body.detail = detail;
    if (errors) body.errors = errors;

    const ms =
      Date.now() -
      ((req as unknown as Record<string, number>).__startTime ?? Date.now());
    this.logger.log(
      `${req.method} ${req.path} ${status} ${ms}ms` +
        ` rid=${requestId}` +
        ` actor=${req.user?.userId ?? '-'}` +
        ` code=${code}`,
    );

    res.status(status).json(body);
  }
}
