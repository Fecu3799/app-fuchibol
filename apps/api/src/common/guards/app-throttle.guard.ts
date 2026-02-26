import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Custom throttler guard that keys by authenticated actorId when available,
 * falling back to IP. For login routes, combines IP + normalized email.
 */
@Injectable()
export class AppThrottleGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    // Authenticated user → key by userId
    if (req.user?.userId) {
      return Promise.resolve(req.user.userId);
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

    // Login endpoint → combine IP + normalized identifier for brute-force protection
    if (req.path.endsWith('/auth/login') && req.method === 'POST') {
      const identifier =
        typeof req.body?.identifier === 'string'
          ? req.body.identifier.toLowerCase().trim()
          : '';
      if (identifier) return Promise.resolve(`${ip}:${identifier}`);
    }

    return Promise.resolve(ip);
  }

  /**
   * Skip throttling for health endpoint.
   */
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    return Promise.resolve(req.path.endsWith('/health'));
  }
}
