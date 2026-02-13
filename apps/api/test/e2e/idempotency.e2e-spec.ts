import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { expectError } from './helpers/assertions';
import { truncateAll } from './helpers/db.helper';

describe('Idempotency (e2e)', () => {
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

  it('replay same idempotency key + same body → same response', async () => {
    const owner = await createAuthenticatedUser(server, 'owner-idem');
    const user = await createAuthenticatedUser(server, 'user-idem');
    const { id, revision } = await createMatch(server, owner.token);

    // Owner invites user
    const inviteKey = randomKey();
    await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', inviteKey)
      .send({ expectedRevision: revision, userId: user.userId });

    // Get updated revision
    const snap = await getMatch(server, user.token, id);
    const rev = snap.body.match.revision;

    // User confirms
    const confirmKey = randomKey();
    const body = { expectedRevision: rev };

    const res1 = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', confirmKey)
      .send(body);

    expect(res1.status).toBe(201);

    // Replay with same key + same body
    const res2 = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', confirmKey)
      .send(body);

    expect(res2.status).toBe(201);
    expect(res2.body.confirmedCount).toBe(res1.body.confirmedCount);
  });

  it('same idempotency key + different body → 409 IDEMPOTENCY_KEY_REUSE', async () => {
    const owner = await createAuthenticatedUser(server, 'owner-idem2');
    const user = await createAuthenticatedUser(server, 'user-idem2');
    const { id, revision } = await createMatch(server, owner.token);

    // Owner invites user
    const inviteKey = randomKey();
    await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', inviteKey)
      .send({ expectedRevision: revision, userId: user.userId });

    const snap = await getMatch(server, user.token, id);
    const rev = snap.body.match.revision;

    const key = randomKey();

    // First request
    await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', key)
      .send({ expectedRevision: rev });

    // Same key, different body (different expectedRevision)
    const res = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', key)
      .send({ expectedRevision: rev + 100 });

    expectError(res, { status: 409, code: 'IDEMPOTENCY_KEY_REUSE' });
  });

  it('missing idempotency key → 422', async () => {
    const owner = await createAuthenticatedUser(server, 'owner-idem3');
    const { id, revision } = await createMatch(server, owner.token);

    const res = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision });

    expect(res.status).toBe(422);
  });
});
