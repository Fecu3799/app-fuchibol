import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';
import { expectError } from './helpers/assertions';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

type Server = ReturnType<INestApplication['getHttpServer']>;

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

describe('Leave Match (e2e)', () => {
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

  it('non-creator leave → hard deletes participation row', async () => {
    const creator = await createAuthenticatedUser(server, 'lv-creator');
    const user = await createAuthenticatedUser(server, 'lv-user');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, user.userId, rev);
    rev = await confirm(server, user.token, id, rev);

    // Verify user is confirmed
    let snap = await getMatch(server, creator.token, id);
    expect(snap.body.match.confirmedCount).toBe(1);

    // User leaves
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(leaveRes.status).toBe(201);

    // Verify: user is completely gone from snapshot
    snap = await getMatch(server, creator.token, id);
    expect(snap.body.match.confirmedCount).toBe(0);
    const userInParticipants = snap.body.match.participants.find(
      (p: { userId: string }) => p.userId === user.userId,
    );
    expect(userInParticipants).toBeUndefined();

    // Verify: row is deleted from DB
    const prisma = app.get(PrismaService);
    const row = await prisma.client.matchParticipant.findUnique({
      where: { matchId_userId: { matchId: id, userId: user.userId } },
    });
    expect(row).toBeNull();
  });

  it('leave is idempotent (no row → returns snapshot)', async () => {
    const creator = await createAuthenticatedUser(server, 'id-creator');
    const user = await createAuthenticatedUser(server, 'id-user');
    const { id } = await createMatch(server, creator.token);

    // User is not a participant — leave should be idempotent
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: 1 });

    expect(leaveRes.status).toBe(201);
    expect(leaveRes.body.myStatus).toBeNull();
  });

  it('re-invite after leave works (row is recreated)', async () => {
    const creator = await createAuthenticatedUser(server, 'ri-creator');
    const user = await createAuthenticatedUser(server, 'ri-user');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, user.userId, rev);
    rev = await confirm(server, user.token, id, rev);

    // Leave
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(user.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = leaveRes.body.revision;

    // Re-invite
    rev = await invite(server, creator.token, id, user.userId, rev);

    // Verify: user is back as INVITED
    const snap = await getMatch(server, user.token, id);
    expect(snap.body.match.myStatus).toBe('INVITED');
  });

  it('creator leave without admin → 422 CREATOR_TRANSFER_REQUIRED', async () => {
    const creator = await createAuthenticatedUser(server, 'ct-creator');
    const { id } = await createMatch(server, creator.token);

    // Creator confirms self
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: 1 });
    const rev = confirmRes.body.revision;

    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expectError(leaveRes, { status: 422, code: 'CREATOR_TRANSFER_REQUIRED' });
  });

  it('creator leave with admin → transfers and hard deletes creator', async () => {
    const creator = await createAuthenticatedUser(server, 'tx-creator');
    const admin = await createAuthenticatedUser(server, 'tx-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;

    // Creator confirms self
    const cc = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = cc.body.revision;

    // Invite, confirm, promote admin
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const pr = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = pr.body.revision;

    // Creator leaves
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(leaveRes.status).toBe(201);
    expect(leaveRes.body.createdById).toBe(admin.userId);

    // Verify: creator completely gone
    const prisma = app.get(PrismaService);
    const creatorRow = await prisma.client.matchParticipant.findUnique({
      where: { matchId_userId: { matchId: id, userId: creator.userId } },
    });
    expect(creatorRow).toBeNull();

    // New creator (admin) is confirmed
    const snap = await getMatch(server, admin.token, id);
    expect(snap.body.match.createdById).toBe(admin.userId);
    expect(snap.body.match.myStatus).toBe('CONFIRMED');
  });

  it('leave confirmed promotes waitlist', async () => {
    const creator = await createAuthenticatedUser(server, 'wl-creator');
    const a = await createAuthenticatedUser(server, 'wl-a');
    const b = await createAuthenticatedUser(server, 'wl-b');
    const c = await createAuthenticatedUser(server, 'wl-c');
    const { id } = await createMatch(server, creator.token, { capacity: 2 });

    let rev = 1;
    rev = await invite(server, creator.token, id, a.userId, rev);
    rev = await invite(server, creator.token, id, b.userId, rev);
    rev = await invite(server, creator.token, id, c.userId, rev);

    rev = await confirm(server, a.token, id, rev);
    rev = await confirm(server, b.token, id, rev);
    rev = await confirm(server, c.token, id, rev); // goes to waitlist

    // a leaves (was confirmed) → c should be promoted
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(a.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(leaveRes.status).toBe(201);

    const snap = await getMatch(server, creator.token, id);
    expect(snap.body.match.confirmedCount).toBe(2);
    expect(snap.body.match.waitlist).toHaveLength(0);

    const confirmedIds = snap.body.match.participants
      .filter((p: { status: string }) => p.status === 'CONFIRMED')
      .map((p: { userId: string }) => p.userId);
    expect(confirmedIds).toContain(b.userId);
    expect(confirmedIds).toContain(c.userId);
  });
});
