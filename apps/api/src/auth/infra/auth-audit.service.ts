import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    eventType: string;
    userId?: string | null;
    sessionId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.client.authAuditEvent.create({
      data: {
        eventType: data.eventType,
        userId: data.userId ?? null,
        sessionId: data.sessionId ?? null,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,

        metadata: (data.metadata ?? {}) as any,
      },
    });
  }
}
