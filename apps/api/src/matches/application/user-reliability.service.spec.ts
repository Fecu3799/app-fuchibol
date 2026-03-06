import { Test } from '@nestjs/testing';
import { UserReliabilityService } from './user-reliability.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

const mockTx = () => ({
  user: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
});

describe('UserReliabilityService', () => {
  let service: UserReliabilityService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserReliabilityService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get(UserReliabilityService);
  });

  it('applies penalty: score 100 → 90 and sets windowStartedAt', async () => {
    const tx = mockTx();
    const now = new Date('2026-03-06T12:00:00Z');

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 100,
      reliabilityWindowStartedAt: null,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 90,
        reliabilityWindowStartedAt: now,
      },
    });
  });

  it('score reaches 0 within 30 days → sets suspendedUntil = now + 14 days', async () => {
    const tx = mockTx();
    const windowStart = new Date('2026-03-01T00:00:00Z');
    const now = new Date('2026-03-06T12:00:00Z');
    const expectedSuspendedUntil = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000,
    );

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 10,
      reliabilityWindowStartedAt: windowStart,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 0,
        reliabilityWindowStartedAt: windowStart,
        suspendedUntil: expectedSuspendedUntil,
      },
    });
  });

  it('already suspended (suspendedUntil > now) → no-op', async () => {
    const tx = mockTx();
    const now = new Date('2026-03-06T12:00:00Z');
    const futureSuspension = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 0,
      reliabilityWindowStartedAt: new Date('2026-02-20T00:00:00Z'),
      suspendedUntil: futureSuspension,
    });

    await service.applyLateLeavePenalty(tx as any, 'user-1', now);

    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('window > 30 days expired → resets windowStartedAt to now', async () => {
    const tx = mockTx();
    const oldWindow = new Date('2026-01-01T00:00:00Z'); // > 30 days ago
    const now = new Date('2026-03-06T12:00:00Z');

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 50,
      reliabilityWindowStartedAt: oldWindow,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 40,
        reliabilityWindowStartedAt: now, // reset
      },
    });
  });
});
