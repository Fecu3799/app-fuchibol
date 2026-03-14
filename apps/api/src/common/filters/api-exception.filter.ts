import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';
import type { MetricsService } from '../../metrics/metrics.service';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: unknown;
  requestId: string;
  suspendedUntil?: string;
}

const STATUS_CODE_MAP: Record<number, string> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.VALIDATION_ERROR,
  429: ErrorCode.RATE_LIMITED,
};

const DOMAIN_CONFLICT_CODES = new Set<string>([
  ErrorCode.REVISION_CONFLICT,
  ErrorCode.MATCH_LOCKED,
  ErrorCode.MATCH_CANCELLED,
  ErrorCode.IDEMPOTENCY_REPLAY, // wire: 'IDEMPOTENCY_KEY_REUSE'
  ErrorCode.SELF_INVITE,
  ErrorCode.ALREADY_PARTICIPANT,
]);

const DOMAIN_UNPROCESSABLE_CODES = new Set<string>([
  ErrorCode.CREATOR_WITHDRAW_REQUIRES_ADMIN,
  ErrorCode.CREATOR_TRANSFER_REQUIRED,
  ErrorCode.CANNOT_DEMOTE_CREATOR,
  ErrorCode.NOT_PARTICIPANT,
  ErrorCode.TERMS_NOT_ACCEPTED,
  ErrorCode.INVALID_CONTENT_TYPE,
  ErrorCode.FILE_TOO_LARGE,
  ErrorCode.INVALID_AVATAR_KEY,
]);

const DOMAIN_FORBIDDEN_CODES = new Set<string>([
  ErrorCode.EMAIL_NOT_VERIFIED,
  ErrorCode.ACCOUNT_SUSPENDED,
  ErrorCode.USER_BANNED,
]);

const DOMAIN_UNAUTHORIZED_CODES = new Set<string>([
  ErrorCode.REFRESH_REUSED,
  ErrorCode.SESSION_REVOKED,
  ErrorCode.REFRESH_EXPIRED,
]);

const DOMAIN_NOT_FOUND_CODES = new Set<string>([ErrorCode.USER_NOT_FOUND]);

function resolveCode(status: number, response: unknown): string {
  if (typeof response === 'object' && response !== null) {
    const msg = (response as Record<string, unknown>).message;
    if (typeof msg === 'string') {
      if (status === 409) {
        if (DOMAIN_CONFLICT_CODES.has(msg)) return msg;
        if (msg.startsWith('CAPACITY_BELOW_CONFIRMED'))
          return ErrorCode.CAPACITY_BELOW_CONFIRMED;
      }
      if (status === 403 && DOMAIN_FORBIDDEN_CODES.has(msg)) return msg;
      if (status === 401 && DOMAIN_UNAUTHORIZED_CODES.has(msg)) return msg;
      if (status === 422 && DOMAIN_UNPROCESSABLE_CODES.has(msg)) return msg;
      if (status === 404 && DOMAIN_NOT_FOUND_CODES.has(msg)) return msg;
    }
  }
  return STATUS_CODE_MAP[status] ?? ErrorCode.UNEXPECTED_ERROR;
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

function resolveSuspendedUntil(response: unknown): string | undefined {
  if (typeof response === 'object' && response !== null) {
    const val = (response as Record<string, unknown>).suspendedUntil;
    if (typeof val === 'string') return val;
  }
  return undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly metrics?: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = req.requestId ?? '-';
    const ms = Date.now() - (req.startTime ?? Date.now());

    let status: number;
    let response: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      response = exception.getResponse();
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      response = { message: 'Internal server error' };
      this.logger.error(
        {
          msg: 'Unhandled exception',
          source: 'ExceptionFilter',
          method: req.method,
          path: req.path,
          rid: requestId,
          actorUserId: req.user?.userId ?? '-',
          ms,
          errorCode: ErrorCode.UNEXPECTED_ERROR,
        },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const code = resolveCode(status, response);
    const detail = resolveDetail(response);
    const errors = resolveErrors(status, response);
    const suspendedUntil = resolveSuspendedUntil(response);

    const body: ProblemDetails = {
      type: 'about:blank',
      title: HttpStatus[status] ?? 'Error',
      status,
      code,
      requestId,
    };
    if (detail) body.detail = detail;
    if (errors) body.errors = errors;
    if (suspendedUntil) body.suspendedUntil = suspendedUntil;

    // Log 4xx as warn, 5xx as error
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log';
    this.logger[logLevel]({
      source: 'ExceptionFilter',
      method: req.method,
      path: req.path,
      status,
      ms,
      rid: requestId,
      actorUserId: req.user?.userId ?? '-',
      errorCode: code,
    });

    this.metrics?.observeHistogram('http_request_duration_ms', ms, {
      method: req.method,
      path: req.route?.path
        ? `${req.baseUrl}${req.route.path as string}`
        : 'unknown',
      status_class: `${Math.floor(status / 100)}xx`,
    });

    res.status(status).json(body);
  }
}
