import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const headerUserId = req.header('x-dev-user-id');
    const userId =
      headerUserId && headerUserId.trim() !== '' ? headerUserId : 'dev-user-1';
    req.user = { id: userId };
    next();
  }
}
