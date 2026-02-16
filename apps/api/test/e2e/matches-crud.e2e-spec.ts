import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';

describe('Matches CRUD (e2e)', () => {
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

  it('POST /matches → 201 with id, revision 1, status scheduled', async () => {
    const { token } = await createAuthenticatedUser(server);
    const match = await createMatch(server, token);

    expect(match.id).toBeDefined();
    expect(match.revision).toBe(1);
  });

  it('GET /matches → 200 with items and pageInfo', async () => {
    const { token } = await createAuthenticatedUser(server);
    await createMatch(server, token);

    const res = await request(server)
      .get('/api/v1/matches')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.pageInfo).toBeDefined();
  });

  it('GET /matches/:id → 200 with full snapshot', async () => {
    const { token } = await createAuthenticatedUser(server);
    const { id } = await createMatch(server, token);

    const res = await getMatch(server, token, id);

    expect(res.status).toBe(200);
    expect(res.body.match).toMatchObject({
      id,
      revision: 1,
      status: 'scheduled',
      isLocked: false,
      confirmedCount: 0,
    });
    expect(res.body.match.capacity).toBeDefined();
  });

  it('GET /matches/:id → participants include username, no email', async () => {
    const admin = await createAuthenticatedUser(server, 'crud-admin');
    const target = await createAuthenticatedUser(server, 'crud-target');
    const { id, revision } = await createMatch(server, admin.token);

    // Invite target by email
    const inviteRes = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomUUID())
      .send({
        identifier: target.email,
        expectedRevision: revision,
      });
    expect(inviteRes.status).toBe(201);

    const res = await getMatch(server, admin.token, id);
    expect(res.status).toBe(200);

    const invited = res.body.match.participants.find(
      (p: { userId: string }) => p.userId === target.userId,
    );
    expect(invited).toBeDefined();
    expect(invited.username).toEqual(expect.any(String));
    expect(invited.username.length).toBeGreaterThan(0);
    // email must NOT be exposed
    expect(invited.email).toBeUndefined();
  });
});
