import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';

describe('Participation (e2e)', () => {
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

  it('invite → confirm → withdraw → confirmedCount changes', async () => {
    const owner = await createAuthenticatedUser(server, 'part-owner');
    const user = await createAuthenticatedUser(server, 'part-user');
    const { id, revision } = await createMatch(server, owner.token, {
      capacity: 10,
    });

    // Invite
    const inviteRes = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: revision, userId: user.userId });

    expect(inviteRes.status).toBe(201);
    let rev = inviteRes.body.revision;

    // Confirm
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body.confirmedCount).toBe(1);
    rev = confirmRes.body.revision;

    // Withdraw
    const withdrawRes = await request(server)
      .post(`/api/v1/matches/${id}/withdraw`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(withdrawRes.status).toBe(201);
    expect(withdrawRes.body.confirmedCount).toBe(0);
  });

  it('invite → decline flow', async () => {
    const owner = await createAuthenticatedUser(server, 'dec-owner');
    const user = await createAuthenticatedUser(server, 'dec-user');
    const { id, revision } = await createMatch(server, owner.token);

    // Invite
    const inviteRes = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: revision, userId: user.userId });

    const rev = inviteRes.body.revision;

    // Decline
    const declineRes = await request(server)
      .post(`/api/v1/matches/${id}/decline`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(declineRes.status).toBe(201);
    expect(declineRes.body.confirmedCount).toBe(0);
  });
});
