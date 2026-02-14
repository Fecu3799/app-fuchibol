import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { truncateAll } from './helpers/db.helper';

describe('Invite by identifier (e2e)', () => {
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

  async function createMatch(token: string) {
    const res = await request(server)
      .post('/api/v1/matches')
      .set(authHeader(token))
      .send({
        title: 'Invite Test',
        startsAt: new Date(Date.now() + 86400_000).toISOString(),
        capacity: 10,
      });
    expect(res.status).toBe(201);
    return res.body;
  }

  it('invite by username creates INVITED participant', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin1');
    const target = await createAuthenticatedUser(server, 'inv-target1');
    const match = await createMatch(admin.token);

    // Get target's username from register response — we registered via helper,
    // so fetch /me to get username
    const meRes = await request(server)
      .get('/api/v1/me')
      .set(authHeader(target.token));
    const username = meRes.body.username as string;

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: username, expectedRevision: match.revision });

    expect(res.status).toBe(201);
    // Snapshot should include the invited participant
    const participant = res.body.participants.find(
      (p: { userId: string }) => p.userId === target.userId,
    );
    expect(participant).toBeDefined();
    expect(participant.status).toBe('INVITED');
  });

  it('invite by @username works', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin2');
    const target = await createAuthenticatedUser(server, 'inv-target2');
    const match = await createMatch(admin.token);

    const meRes = await request(server)
      .get('/api/v1/me')
      .set(authHeader(target.token));
    const username = meRes.body.username as string;

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: `@${username}`, expectedRevision: match.revision });

    expect(res.status).toBe(201);
  });

  it('invite by email works', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin3');
    const target = await createAuthenticatedUser(server, 'inv-target3');
    const match = await createMatch(admin.token);

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: target.email, expectedRevision: match.revision });

    expect(res.status).toBe(201);
    const participant = res.body.participants.find(
      (p: { userId: string }) => p.userId === target.userId,
    );
    expect(participant).toBeDefined();
    expect(participant.status).toBe('INVITED');
  });

  it('404 USER_NOT_FOUND for unknown identifier', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin4');
    const match = await createMatch(admin.token);

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({
        identifier: 'nonexistent_user',
        expectedRevision: match.revision,
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('409 SELF_INVITE when admin invites self', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin5');
    const match = await createMatch(admin.token);

    const meRes = await request(server)
      .get('/api/v1/me')
      .set(authHeader(admin.token));

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({
        identifier: meRes.body.username,
        expectedRevision: match.revision,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SELF_INVITE');
  });

  it('409 ALREADY_PARTICIPANT when user is already confirmed', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin6');
    const target = await createAuthenticatedUser(server, 'inv-target6');
    const match = await createMatch(admin.token);

    // Invite first
    const invRes = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: target.email, expectedRevision: match.revision });
    expect(invRes.status).toBe(201);

    // Target confirms
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${match.id}/confirm`)
      .set(authHeader(target.token))
      .set('Idempotency-Key', randomUUID())
      .send({ expectedRevision: invRes.body.revision });
    expect(confirmRes.status).toBe(201);

    // Admin tries to re-invite (already CONFIRMED)
    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({
        identifier: target.email,
        expectedRevision: confirmRes.body.revision,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_PARTICIPANT');
  });

  it('backward compat: invite by userId still works', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin7');
    const target = await createAuthenticatedUser(server, 'inv-target7');
    const match = await createMatch(admin.token);

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ userId: target.userId, expectedRevision: match.revision });

    expect(res.status).toBe(201);
  });

  it('snapshot reflects invited user in participants', async () => {
    const admin = await createAuthenticatedUser(server, 'inv-admin8');
    const target = await createAuthenticatedUser(server, 'inv-target8');
    const match = await createMatch(admin.token);

    const res = await request(server)
      .post(`/api/v1/matches/${match.id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({ identifier: target.email, expectedRevision: match.revision });

    expect(res.status).toBe(201);
    expect(res.body.revision).toBe(match.revision + 1);
    expect(res.body.participants.length).toBeGreaterThanOrEqual(1);
  });
});
