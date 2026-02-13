import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<Response>();
          this.log(req, res.statusCode, start);
        },
        error: () => {
          // Error logging is handled by the exception filter
        },
      }),
    );
  }

  log(req: Request, statusCode: number, start: number) {
    const ms = Date.now() - start;
    this.logger.log(
      `${req.method} ${req.path} ${statusCode} ${ms}ms` +
        ` rid=${req.requestId ?? '-'}` +
        ` actor=${req.user?.userId ?? '-'}`,
    );
  }
}
