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

  it('lock → non-invited user confirm on locked → 409 MATCH_LOCKED', async () => {
    const owner = await createAuthenticatedUser(server, 'lock-owner');
    const outsider = await createAuthenticatedUser(server, 'lock-outsider');
    const { id, revision } = await createMatch(server, owner.token);

    // Lock match (no invitation sent to outsider)
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision });

    expect(lockRes.status).toBe(201);
    expect(lockRes.body.isLocked).toBe(true);

    // Outsider (no participation row) tries to confirm on locked match
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(outsider.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: lockRes.body.revision });

    expectError(confirmRes, { status: 409, code: 'MATCH_LOCKED' });
  });

  it('lock → INVITED user can still confirm on locked match', async () => {
    const owner = await createAuthenticatedUser(server, 'lock-owner2');
    const invited = await createAuthenticatedUser(server, 'lock-invited');
    const { id, revision } = await createMatch(server, owner.token);

    // Invite user before locking
    await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: revision, userId: invited.userId });

    // Lock match
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision + 1 });

    expect(lockRes.status).toBe(201);
    expect(lockRes.body.isLocked).toBe(true);

    // INVITED user confirms even though match is locked
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(invited.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: lockRes.body.revision });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.myStatus).toBe('CONFIRMED');
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
