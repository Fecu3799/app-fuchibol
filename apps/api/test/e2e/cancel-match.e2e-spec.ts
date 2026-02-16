import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';

describe('Cancel Match (e2e)', () => {
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

  it('POST /matches/:id/cancel → 200 with status canceled', async () => {
    const admin = await createAuthenticatedUser(server, 'cancel-admin');
    const { id, revision } = await createMatch(server, admin.token);

    const res = await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: revision });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('canceled');
    expect(res.body.actionsAllowed).toEqual([]);
  });

  it('cancel is idempotent (repeat with same key)', async () => {
    const admin = await createAuthenticatedUser(server, 'cancel-idem');
    const { id, revision } = await createMatch(server, admin.token);
    const key = randomUUID();

    const res1 = await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', key)
      .send({ expectedRevision: revision });

    expect(res1.status).toBe(201);

    // Same key → idempotent replay
    const res2 = await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', key)
      .send({ expectedRevision: revision });

    // Idempotency replay returns 200 with cached response
    expect([200, 201]).toContain(res2.status);
    expect(res2.body.status).toBe('canceled');
  });

  it('confirm after cancel → 409 MATCH_CANCELLED', async () => {
    const admin = await createAuthenticatedUser(server, 'cancel-block-admin');
    const target = await createAuthenticatedUser(server, 'cancel-block-user');
    const { id, revision } = await createMatch(server, admin.token);

    // Invite target
    await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: target.email, expectedRevision: revision });

    // Get fresh revision
    const snapshot = await getMatch(server, admin.token, id);
    const freshRevision = snapshot.body.match.revision;

    // Cancel match
    await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: freshRevision });

    // Get revision after cancel
    const afterCancel = await getMatch(server, target.token, id);
    const cancelRevision = afterCancel.body.match.revision;

    // Target tries to confirm → 409 MATCH_CANCELLED
    const res = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(target.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: cancelRevision });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MATCH_CANCELLED');
  });

  it('actionsAllowed is empty for all users on canceled match', async () => {
    const admin = await createAuthenticatedUser(server, 'cancel-actions-admin');
    const target = await createAuthenticatedUser(server, 'cancel-actions-user');
    const { id, revision } = await createMatch(server, admin.token);

    await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: revision });

    // Admin sees empty actionsAllowed
    const adminSnapshot = await getMatch(server, admin.token, id);
    expect(adminSnapshot.body.match.actionsAllowed).toEqual([]);

    // Non-admin sees empty actionsAllowed
    const userSnapshot = await getMatch(server, target.token, id);
    expect(userSnapshot.body.match.actionsAllowed).toEqual([]);
  });

  it('lock after cancel → 409 MATCH_CANCELLED', async () => {
    const admin = await createAuthenticatedUser(server, 'cancel-lock-admin');
    const { id, revision } = await createMatch(server, admin.token);

    // Cancel
    await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: revision });

    const afterCancel = await getMatch(server, admin.token, id);
    const cancelRevision = afterCancel.body.match.revision;

    // Try lock → 409
    const res = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(admin.token))
      .send({ expectedRevision: cancelRevision });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MATCH_CANCELLED');
  });
});
