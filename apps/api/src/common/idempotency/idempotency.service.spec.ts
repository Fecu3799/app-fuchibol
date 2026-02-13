import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdempotencyService, computeRequestHash } from './idempotency.service';
import type { PrismaService } from '../../infra/prisma/prisma.service';

function buildMocks() {
  const idempotencyRecord = {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };

  const prisma = {
    client: { idempotencyRecord },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;

  const service = new IdempotencyService(prisma, config);

  return { prisma, config, service, idempotencyRecord };
}

describe('IdempotencyService', () => {
  it('first execution stores record with hash and expiresAt', async () => {
    const { service, idempotencyRecord } = buildMocks();
    const execute = jest.fn().mockResolvedValue({ ok: true });

    const result = await service.run({
      key: 'k1',
      actorId: 'a1',
      route: 'POST /test',
      requestBody: { foo: 'bar' },
      execute,
    });

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'k1',
          actorId: 'a1',
          route: 'POST /test',
          requestHash: computeRequestHash({ foo: 'bar' }),
          responseJson: { ok: true },
        }),
      }),
    );
    const { expiresAt } = idempotencyRecord.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('replay: same key + same hash returns cached response without executing', async () => {
    const { service, idempotencyRecord } = buildMocks();
    const hash = computeRequestHash({ foo: 'bar' });
    const cached = {
      id: 'rec-1',
      requestHash: hash,
      responseJson: { cached: true },
      expiresAt: new Date(Date.now() + 60_000),
    };
    idempotencyRecord.findUnique.mockResolvedValue(cached);

    const execute = jest.fn();

    const result = await service.run({
      key: 'k1',
      actorId: 'a1',
      route: 'POST /test',
      requestBody: { foo: 'bar' },
      execute,
    });

    expect(result).toEqual({ cached: true });
    expect(execute).not.toHaveBeenCalled();
    expect(idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('reuse: same key + different hash throws 409 IDEMPOTENCY_KEY_REUSE', async () => {
    const { service, idempotencyRecord } = buildMocks();
    const cached = {
      id: 'rec-1',
      requestHash: computeRequestHash({ foo: 'bar' }),
      responseJson: { cached: true },
      expiresAt: new Date(Date.now() + 60_000),
    };
    idempotencyRecord.findUnique.mockResolvedValue(cached);

    const execute = jest.fn();

    await expect(
      service.run({
        key: 'k1',
        actorId: 'a1',
        route: 'POST /test',
        requestBody: { different: 'body' },
        execute,
      }),
    ).rejects.toThrow(ConflictException);

    expect(execute).not.toHaveBeenCalled();
  });

  it('expired record is deleted and re-executed', async () => {
    const { service, idempotencyRecord } = buildMocks();
    const expired = {
      id: 'rec-old',
      requestHash: computeRequestHash({ foo: 'bar' }),
      responseJson: { old: true },
      expiresAt: new Date(Date.now() - 1000),
    };
    idempotencyRecord.findUnique.mockResolvedValue(expired);

    const execute = jest.fn().mockResolvedValue({ fresh: true });

    const result = await service.run({
      key: 'k1',
      actorId: 'a1',
      route: 'POST /test',
      requestBody: { foo: 'bar' },
      execute,
    });

    expect(idempotencyRecord.delete).toHaveBeenCalledWith({
      where: { id: 'rec-old' },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fresh: true });
  });
});

describe('computeRequestHash', () => {
  it('same body produces same hash', () => {
    const h1 = computeRequestHash({ a: 1, b: 2 });
    const h2 = computeRequestHash({ a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it('different body produces different hash', () => {
    const h1 = computeRequestHash({ a: 1 });
    const h2 = computeRequestHash({ a: 2 });
    expect(h1).not.toBe(h2);
  });
});
