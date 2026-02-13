import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Custom throttler guard that keys by authenticated actorId when available,
 * falling back to IP. For login routes, combines IP + normalized email.
 */
@Injectable()
export class AppThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Authenticated user → key by userId
    if (req.user?.userId) {
      return req.user.userId;
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

    // Login endpoint → combine IP + normalized email for brute-force protection
    if (req.path.endsWith('/auth/login') && req.method === 'POST') {
      const email = typeof req.body?.email === 'string'
        ? req.body.email.toLowerCase().trim()
        : '';
      if (email) return `${ip}:${email}`;
    }

    return ip;
  }

  /**
   * Skip throttling for health endpoint.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    return req.path.endsWith('/health');
  }
}
