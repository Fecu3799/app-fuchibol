import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AuthAuditService } from '../../infra/auth-audit.service';

@Injectable()
export class RevokeSessionCommand {
  private readonly logger = new Logger(RevokeSessionCommand.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async execute(sessionId: string, requestingUserId: string): Promise<void> {
    const session = await this.prisma.client.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== requestingUserId) {
      throw new ForbiddenException("Cannot revoke another user's session");
    }

    if (session.revokedAt) {
      return; // already revoked — idempotent
    }

    await this.prisma.client.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(
      `revoke_session userId=${requestingUserId} sessionId=${sessionId}`,
    );
    void this.auditService
      .log({
        eventType: 'session_revoked',
        userId: requestingUserId,
        sessionId: requestingUserId,
        metadata: { revokedSessionId: sessionId },
      })
      .catch((err) => this.logger.warn('audit_log_failed', err));
  }
}
