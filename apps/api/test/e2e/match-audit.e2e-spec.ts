import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';

describe('Match Audit Logs (e2e)', () => {
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

  // Helper to get audit logs for a match
  async function getAuditLogs(
    token: string,
    matchId: string,
    params: Record<string, number> = {},
  ) {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const url = `/api/v1/matches/${matchId}/audit-logs${qs ? `?${qs}` : ''}`;
    return request(server).get(url).set(authHeader(token));
  }

  it('lock and unlock actions produce audit log entries', async () => {
    const owner = await createAuthenticatedUser(app, 'audit-lock');
    const { id, revision } = await createMatch(server, owner.token);

    // Lock
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision });

    expect(lockRes.status).toBe(201);
    const revAfterLock = lockRes.body.revision as number;

    // Unlock
    const unlockRes = await request(server)
      .post(`/api/v1/matches/${id}/unlock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revAfterLock });

    expect(unlockRes.status).toBe(201);

    // Check audit logs
    const logsRes = await getAuditLogs(owner.token, id);
    expect(logsRes.status).toBe(200);

    const types = (logsRes.body.items as { type: string }[]).map((e) => e.type);
    expect(types).toContain('match.locked');
    expect(types).toContain('match.unlocked');
  });

  it('leave by confirmed user with waitlist produces participant.left + waitlist.promoted logs', async () => {
    const owner = await createAuthenticatedUser(app, 'audit-leave-own');
    const user1 = await createAuthenticatedUser(app, 'audit-leave-u1');
    const user2 = await createAuthenticatedUser(app, 'audit-leave-u2');

    // Create match with capacity 1 (so the second confirm goes to waitlist)
    const { id, revision } = await createMatch(server, owner.token, {
      capacity: 1,
    });

    // Invite user1
    const inv1 = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: revision, userId: user1.userId });
    expect(inv1.status).toBe(201);

    // Invite user2
    const inv2 = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(owner.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: inv1.body.revision, userId: user2.userId });
    expect(inv2.status).toBe(201);

    // user1 confirms (fills the slot)
    const conf1 = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user1.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: inv2.body.revision });
    expect(conf1.status).toBe(201);
    expect(conf1.body.confirmedCount).toBe(1);

    // user2 confirms (goes to waitlist)
    const conf2 = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(user2.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: conf1.body.revision });
    expect(conf2.status).toBe(201);
    expect(conf2.body.waitlist).toHaveLength(1);

    // user1 leaves → user2 gets promoted from waitlist
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(user1.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: conf2.body.revision });
    expect(leaveRes.status).toBe(201);

    // Check audit logs
    const logsRes = await getAuditLogs(owner.token, id);
    expect(logsRes.status).toBe(200);

    const types = (logsRes.body.items as { type: string }[]).map((e) => e.type);
    expect(types).toContain('participant.left');
    expect(types).toContain('waitlist.promoted');
  });

  it('major match update produces match.updated_major log with fieldsChanged', async () => {
    const owner = await createAuthenticatedUser(app, 'audit-update');
    const { id, revision } = await createMatch(server, owner.token);

    // Change startsAt (major change)
    const newStartsAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const updateRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision, startsAt: newStartsAt });

    expect(updateRes.status).toBe(200);

    const logsRes = await getAuditLogs(owner.token, id);
    expect(logsRes.status).toBe(200);

    const items = logsRes.body.items as {
      type: string;
      metadata: Record<string, unknown>;
    }[];
    const updateLog = items.find((e) => e.type === 'match.updated_major');
    expect(updateLog).toBeDefined();
    expect(Array.isArray(updateLog!.metadata.fieldsChanged)).toBe(true);
    expect(updateLog!.metadata.fieldsChanged).toContain('startsAt');
  });

  it('GET audit-logs returns paginated results with correct pageInfo', async () => {
    const owner = await createAuthenticatedUser(app, 'audit-page');
    const { id, revision } = await createMatch(server, owner.token);

    // Produce 3 audit events: lock, unlock, lock
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: revision });
    expect(lockRes.status).toBe(201);

    const unlockRes = await request(server)
      .post(`/api/v1/matches/${id}/unlock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: lockRes.body.revision });
    expect(unlockRes.status).toBe(201);

    const lock2Res = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: unlockRes.body.revision });
    expect(lock2Res.status).toBe(201);

    // Fetch page 1 with pageSize=2
    const page1 = await getAuditLogs(owner.token, id, { page: 1, pageSize: 2 });
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.pageInfo.totalItems).toBe(3);
    expect(page1.body.pageInfo.hasNextPage).toBe(true);
    expect(page1.body.pageInfo.hasPrevPage).toBe(false);

    // Fetch page 2
    const page2 = await getAuditLogs(owner.token, id, { page: 2, pageSize: 2 });
    expect(page2.status).toBe(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.pageInfo.hasNextPage).toBe(false);
    expect(page2.body.pageInfo.hasPrevPage).toBe(true);
  });

  it('GET audit-logs returns 401 when unauthenticated', async () => {
    const owner = await createAuthenticatedUser(app, 'audit-unauth');
    const { id } = await createMatch(server, owner.token);

    const res = await request(server).get(`/api/v1/matches/${id}/audit-logs`);
    expect(res.status).toBe(401);
  });
});
