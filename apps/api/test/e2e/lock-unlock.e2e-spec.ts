import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { expectError } from './helpers/assertions';
import { truncateAll } from './helpers/db.helper';

describe('Lock / Unlock (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    app = await createE2eApp();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await truncateAll(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lock → isLocked true, confirm on locked → 409 MATCH_LOCKED', async () => {
    const owner = await createAuthenticatedUser(server, 'lock-owner');
    const user = await createAuthenticatedUser(server, 'lock-user');
    const { id, revision } = await createMatch(server, owner.token);

    // Invite user
    await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: revision, userId: user.userId });

    // Lock match
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision + 1 });

    expect(lockRes.status).toBe(201);
    expect(lockRes.body.isLocked).toBe(true);

    // Confirm on locked match
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: lockRes.body.revision });

    expectError(confirmRes, { status: 409, code: 'MATCH_LOCKED' });
  });

  it('unlock → isLocked false', async () => {
    const owner = await createAuthenticatedUser(server, 'unlock-owner');
    const { id, revision } = await createMatch(server, owner.token);

    // Lock
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision });

    // Unlock
    const unlockRes = await request(server)
      .post(`/api/v1/matches/${id}/unlock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: lockRes.body.revision });

    expect(unlockRes.status).toBe(201);
    expect(unlockRes.body.isLocked).toBe(false);
  });
});
