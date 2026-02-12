import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (req.headers.authorization) {
      return next();
    }

    const headerUserId = req.header('x-dev-user-id');
    if (headerUserId && headerUserId.trim() !== '') {
      req.user = { userId: headerUserId, role: 'USER' };
    }

    next();
  }
}
