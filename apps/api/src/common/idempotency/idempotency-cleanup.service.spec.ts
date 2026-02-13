import { ConfigService } from '@nestjs/config';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

function buildMocks() {
  const idempotencyRecord = {
    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
  };

  const prisma = {
    client: { idempotencyRecord },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const service = new IdempotencyCleanupService(prisma, config);

  return { service, idempotencyRecord };
}

describe('IdempotencyCleanupService', () => {
  it('cleanup deletes expired records', async () => {
    const { service, idempotencyRecord } = buildMocks();

    const count = await service.cleanup();

    expect(count).toBe(3);
    expect(idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
