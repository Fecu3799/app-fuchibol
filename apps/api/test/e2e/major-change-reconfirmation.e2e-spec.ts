import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

type Server = ReturnType<INestApplication['getHttpServer']>;

/** Invite a user and return updated revision */
async function invite(
  server: Server,
  ownerToken: string,
  matchId: string,
  userId: string,
  rev: number,
) {
  const res = await request(server)
    .post(`/api/v1/matches/${matchId}/invite`)
    .set(authHeader(ownerToken))
    .set('Idempotency-Key', randomKey())
    .send({ expectedRevision: rev, userId });
  expect(res.status).toBe(201);
  return res.body.revision as number;
}

/** Confirm and return updated revision */
async function confirm(
  server: Server,
  token: string,
  matchId: string,
  rev: number,
) {
  const res = await request(server)
    .post(`/api/v1/matches/${matchId}/confirm`)
    .set(authHeader(token))
    .set('Idempotency-Key', randomKey())
    .send({ expectedRevision: rev });
  expect(res.status).toBe(201);
  return res.body.revision as number;
}

async function getParticipants(app: INestApplication, matchId: string) {
  const prisma = app.get(PrismaService);
  return prisma.client.matchParticipant.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
  });
}

describe('Major Change Reconfirmation (e2e)', () => {
  let app: INestApplication;
  let server: Server;

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

  it('startsAt change resets confirmed→invited, waitlist untouched', async () => {
    const owner = await createAuthenticatedUser(server, 'mc-owner');
    const u1 = await createAuthenticatedUser(server, 'mc-u1');
    const u2 = await createAuthenticatedUser(server, 'mc-u2');
    const u3 = await createAuthenticatedUser(server, 'mc-u3');
    const u4 = await createAuthenticatedUser(server, 'mc-u4');

    const { id } = await createMatch(server, owner.token, { capacity: 2 });

    // Invite all 4
    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await invite(server, owner.token, id, u2.userId, rev);
    rev = await invite(server, owner.token, id, u3.userId, rev);
    rev = await invite(server, owner.token, id, u4.userId, rev);

    // u1, u2 confirm (fill capacity)
    rev = await confirm(server, u1.token, id, rev);
    rev = await confirm(server, u2.token, id, rev);

    // u3, u4 confirm (go to waitlist)
    rev = await confirm(server, u3.token, id, rev);
    rev = await confirm(server, u4.token, id, rev);

    // Verify: 2 confirmed, 2 waitlisted
    const snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.confirmedCount).toBe(2);
    expect(snap.body.match.waitlist).toHaveLength(2);

    // PATCH startsAt (major change)
    const newDate = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, startsAt: newDate });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.revision).toBe(rev + 1);

    // Verify snapshot: confirmedCount should be 0 (all reset to invited)
    expect(patchRes.body.confirmedCount).toBe(0);

    // Verify DB directly
    const participants = await getParticipants(app, id);
    const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
    const invited = participants.filter((p) => p.status === 'INVITED');
    const waitlisted = participants.filter((p) => p.status === 'WAITLISTED');

    // u1, u2 were CONFIRMED → now INVITED
    expect(confirmed).toHaveLength(0);
    expect(invited.map((p) => p.userId).sort()).toEqual(
      [u1.userId, u2.userId].sort(),
    );

    // u3, u4 still WAITLISTED (untouched)
    expect(waitlisted).toHaveLength(2);
    expect(waitlisted.map((p) => p.userId).sort()).toEqual(
      [u3.userId, u4.userId].sort(),
    );
  });

  it('location change triggers reconfirmation', async () => {
    const owner = await createAuthenticatedUser(server, 'loc-owner');
    const u1 = await createAuthenticatedUser(server, 'loc-u1');

    const { id } = await createMatch(server, owner.token, { capacity: 5 });

    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await confirm(server, u1.token, id, rev);

    // Verify confirmed
    let snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.confirmedCount).toBe(1);

    // PATCH location (major change)
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, location: 'Cancha Sur' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.confirmedCount).toBe(0);

    // u1 should be INVITED again
    snap = await getMatch(server, u1.token, id);
    expect(snap.body.match.myStatus).toBe('INVITED');
    expect(snap.body.match.actionsAllowed).toContain('confirm');
  });

  it('capacity reduction triggers reconfirmation', async () => {
    const owner = await createAuthenticatedUser(server, 'cap-owner');
    const u1 = await createAuthenticatedUser(server, 'cap-u1');
    const u2 = await createAuthenticatedUser(server, 'cap-u2');

    const { id } = await createMatch(server, owner.token, { capacity: 5 });

    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await invite(server, owner.token, id, u2.userId, rev);
    rev = await confirm(server, u1.token, id, rev);
    rev = await confirm(server, u2.token, id, rev);

    // 2 confirmed, reduce capacity to 1 (major change → reconfirmation)
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, capacity: 1 });

    expect(patchRes.status).toBe(200);
    // Both reset to INVITED, confirmedCount = 0
    expect(patchRes.body.confirmedCount).toBe(0);
    expect(patchRes.body.capacity).toBe(1);
  });

  it('title-only change does NOT trigger reconfirmation', async () => {
    const owner = await createAuthenticatedUser(server, 'tit-owner');
    const u1 = await createAuthenticatedUser(server, 'tit-u1');

    const { id } = await createMatch(server, owner.token, { capacity: 5 });

    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await confirm(server, u1.token, id, rev);

    // PATCH title only (minor change)
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, title: 'Futbol 7 Viernes' });

    expect(patchRes.status).toBe(200);
    // u1 still confirmed
    expect(patchRes.body.confirmedCount).toBe(1);
  });

  it('same startsAt value does NOT trigger reconfirmation', async () => {
    const owner = await createAuthenticatedUser(server, 'same-owner');
    const u1 = await createAuthenticatedUser(server, 'same-u1');

    const { id } = await createMatch(server, owner.token, { capacity: 5 });

    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await confirm(server, u1.token, id, rev);

    // Get current startsAt
    const snap = await getMatch(server, owner.token, id);
    const currentStartsAt = snap.body.match.startsAt;

    // PATCH with same startsAt (no real change)
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, startsAt: currentStartsAt });

    // No change → no revision bump, return snapshot as-is
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.confirmedCount).toBe(1);
    expect(patchRes.body.revision).toBe(rev); // not incremented
  });

  it('PATCH on locked match → 409 MATCH_LOCKED', async () => {
    const owner = await createAuthenticatedUser(server, 'lk-owner');
    const { id } = await createMatch(server, owner.token);

    // Lock
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: 1 });
    expect(lockRes.status).toBe(201);
    const rev = lockRes.body.revision;

    // PATCH should fail
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({ expectedRevision: rev, title: 'New Title' });

    expect(patchRes.status).toBe(409);
    expect(patchRes.body.code).toBe('MATCH_LOCKED');
  });

  it('confirmedCount <= capacity invariant after reconfirmation', async () => {
    const owner = await createAuthenticatedUser(server, 'inv-owner');
    const users: Awaited<ReturnType<typeof createAuthenticatedUser>>[] = [];
    for (let i = 0; i < 5; i++) {
      users.push(await createAuthenticatedUser(server, `inv-u${i}`));
    }

    const { id } = await createMatch(server, owner.token, { capacity: 5 });

    let rev = 1;
    for (const u of users) {
      rev = await invite(server, owner.token, id, u.userId, rev);
      rev = await confirm(server, u.token, id, rev);
    }

    // All 5 confirmed
    const snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.confirmedCount).toBe(5);

    // Major change → all reset
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(owner.token))
      .send({
        expectedRevision: rev,
        startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.confirmedCount).toBe(0);

    // Invariant check
    expect(patchRes.body.confirmedCount).toBeLessThanOrEqual(
      patchRes.body.capacity,
    );
  });
});
