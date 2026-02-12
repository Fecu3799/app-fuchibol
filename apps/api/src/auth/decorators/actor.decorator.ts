import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ActorPayload } from '../interfaces/actor-payload.interface';

export const Actor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as ActorPayload;
  },
);
