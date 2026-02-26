import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(sessionId: string, userId: string): Promise<void> {
    await this.prisma.client.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`logout userId=${userId} sessionId=${sessionId}`);
  }
}
