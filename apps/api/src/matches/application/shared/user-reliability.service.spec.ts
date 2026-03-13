import { Test } from '@nestjs/testing';
import {
  UserReliabilityService,
  getLateLeavePenaltyPoints,
} from './user-reliability.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';

const mockTx = () => ({
  user: {
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
});

// ── getLateLeavePenaltyPoints ──

describe('getLateLeavePenaltyPoints', () => {
  it.each([
    [61, 0],
    [60, 0],
    [59, 10],
    [50, 10],
    [49, 12],
    [40, 12],
    [39, 15],
    [30, 15],
    [29, 30],
    [20, 30],
    [19, 40],
    [10, 40],
    [9, 50],
    [0, 50],
  ])('%i min → %i penalty', (minutes, expected) => {
    expect(getLateLeavePenaltyPoints(minutes)).toBe(expected);
  });
});

// ── UserReliabilityService ──

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

  it('applies -10 penalty (55 min to start): score 100 → 90 and sets windowStartedAt', async () => {
    const tx = mockTx();
    const now = new Date('2026-03-06T12:00:00Z');

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 100,
      reliabilityWindowStartedAt: null,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', 55, now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 90,
        reliabilityWindowStartedAt: now,
      },
    });
  });

  it('applies -30 penalty (29 min to start): score 40 → 10', async () => {
    const tx = mockTx();
    const now = new Date('2026-03-06T12:00:00Z');

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 40,
      reliabilityWindowStartedAt: null,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', 29, now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 10,
        reliabilityWindowStartedAt: now,
      },
    });
  });

  it('applies -50 penalty (9 min to start): score 30 → clamped to 0', async () => {
    const tx = mockTx();
    const now = new Date('2026-03-06T12:00:00Z');

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 30,
      reliabilityWindowStartedAt: null,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', 9, now);

    const call = tx.user.update.mock.calls[0][0];
    expect(call.data.reliabilityScore).toBe(0);
  });

  it('score reaches 0 within 30-day window → sets suspendedUntil = now + 14 days', async () => {
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

    // 55 min → -10 penalty, score 10 → 0
    await service.applyLateLeavePenalty(tx as any, 'user-1', 55, now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 0,
        reliabilityWindowStartedAt: windowStart,
        suspendedUntil: expectedSuspendedUntil,
      },
    });
  });

  it('suspension triggers with larger penalty (29 min → -30): score 20 → 0 → suspended', async () => {
    const tx = mockTx();
    const windowStart = new Date('2026-03-01T00:00:00Z');
    const now = new Date('2026-03-06T12:00:00Z');
    const expectedSuspendedUntil = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000,
    );

    tx.user.findUniqueOrThrow.mockResolvedValue({
      reliabilityScore: 20,
      reliabilityWindowStartedAt: windowStart,
      suspendedUntil: null,
    });
    tx.user.update.mockResolvedValue({});

    await service.applyLateLeavePenalty(tx as any, 'user-1', 29, now);

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

    await service.applyLateLeavePenalty(tx as any, 'user-1', 55, now);

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

    // 55 min → -10 penalty, score 50 → 40
    await service.applyLateLeavePenalty(tx as any, 'user-1', 55, now);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        reliabilityScore: 40,
        reliabilityWindowStartedAt: now, // reset
      },
    });
  });
});
