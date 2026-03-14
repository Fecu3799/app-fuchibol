import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import type { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics?: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          const ms = Date.now() - (req.startTime ?? Date.now());
          this.logger.log({
            method: req.method,
            path: req.path,
            status: res.statusCode,
            ms,
            rid: req.requestId ?? '-',
            actorUserId: req.user?.userId ?? '-',
          });
          this.metrics?.observeHistogram('http_request_duration_ms', ms, {
            method: req.method,
            path: (req.route?.path as string | undefined) ?? req.path,
            status_class: `${Math.floor(res.statusCode / 100)}xx`,
          });
        },
        error: () => {
          // Error logging is handled by ApiExceptionFilter
        },
      }),
    );
  }
}
