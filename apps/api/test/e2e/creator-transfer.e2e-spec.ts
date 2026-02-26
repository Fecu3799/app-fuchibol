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

describe('Creator Transfer (e2e)', () => {
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

  it('creator leave with no admins → 422 CREATOR_TRANSFER_REQUIRED', async () => {
    const creator = await createAuthenticatedUser(app, 'ct-creator');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    const confirmRes = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    expect(confirmRes.status).toBe(201);
    rev = confirmRes.body.revision;

    // Creator tries to leave without any matchAdmins
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expectError(leaveRes, {
      status: 422,
      code: 'CREATOR_TRANSFER_REQUIRED',
    });
  });

  it('creator leave with 1 admin → transfers creatorId', async () => {
    const creator = await createAuthenticatedUser(app, 'tx-creator');
    const admin = await createAuthenticatedUser(app, 'tx-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;

    // Creator confirms self
    const confirmCreator = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = confirmCreator.body.revision;

    // Invite and confirm admin
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    // Promote admin
    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    // Creator leaves
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    expect(leaveRes.status).toBe(201);

    // Verify: createdById transferred to admin
    const snap = await getMatch(server, admin.token, id);
    expect(snap.body.match.createdById).toBe(admin.userId);

    // Admin is confirmed
    const adminParticipant = snap.body.match.participants.find(
      (p: { userId: string }) => p.userId === admin.userId,
    );
    expect(adminParticipant.status).toBe('CONFIRMED');

    // Admin's myStatus should be CONFIRMED (they are the new creator and participant)
    expect(snap.body.match.myStatus).toBe('CONFIRMED');

    // Creator's row is deleted → myStatus is null
    const creatorSnap = await getMatch(server, creator.token, id);
    expect(creatorSnap.body.match.myStatus).toBeNull();
  });

  it('creator leave with multiple admins → picks earliest adminGrantedAt', async () => {
    const creator = await createAuthenticatedUser(app, 'ma-creator');
    const admin1 = await createAuthenticatedUser(app, 'ma-admin1');
    const admin2 = await createAuthenticatedUser(app, 'ma-admin2');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;

    // Creator confirms self
    const confirmCreator = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = confirmCreator.body.revision;

    // Invite and confirm both admins
    rev = await invite(server, creator.token, id, admin1.userId, rev);
    rev = await confirm(server, admin1.token, id, rev);
    rev = await invite(server, creator.token, id, admin2.userId, rev);
    rev = await confirm(server, admin2.token, id, rev);

    // Promote admin1 first, then admin2
    const promote1 = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin1.userId, expectedRevision: rev });
    rev = promote1.body.revision;

    // Small delay to ensure different adminGrantedAt
    await new Promise((r) => setTimeout(r, 50));

    const promote2 = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin2.userId, expectedRevision: rev });
    rev = promote2.body.revision;

    // Creator leaves
    const leaveRes = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    expect(leaveRes.status).toBe(201);

    // Should transfer to admin1 (earliest adminGrantedAt)
    const snap = await getMatch(server, admin1.token, id);
    expect(snap.body.match.createdById).toBe(admin1.userId);
  });

  it('major change reconfirm skips creator (creator stays CONFIRMED)', async () => {
    const creator = await createAuthenticatedUser(app, 'rc-creator');
    const user = await createAuthenticatedUser(app, 'rc-user');
    const { id } = await createMatch(server, creator.token, { capacity: 10 });

    let rev = 1;

    // Creator confirms self
    const confirmCreator = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = confirmCreator.body.revision;

    // Invite and confirm user
    rev = await invite(server, creator.token, id, user.userId, rev);
    rev = await confirm(server, user.token, id, rev);

    // Major change: update startsAt
    const newDate = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(creator.token))
      .send({ expectedRevision: rev, startsAt: newDate });

    expect(patchRes.status).toBe(200);

    // Verify DB: creator still CONFIRMED, user reset to INVITED
    const prisma = app.get(PrismaService);
    const participants = await prisma.client.matchParticipant.findMany({
      where: { matchId: id },
    });

    const creatorP = participants.find((p) => p.userId === creator.userId);
    const userP = participants.find((p) => p.userId === user.userId);

    expect(creatorP?.status).toBe('CONFIRMED');
    expect(userP?.status).toBe('INVITED');
  });

  it('new creator after transfer gets full creator permissions', async () => {
    const creator = await createAuthenticatedUser(app, 'fp-creator');
    const admin = await createAuthenticatedUser(app, 'fp-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;

    // Creator confirms, invite+confirm admin, promote
    const cc = await request(server)
      .post(`/api/v1/matches/${id}/confirm`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = cc.body.revision;

    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const pr = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = pr.body.revision;

    // Creator leaves → admin becomes creator
    const lr = await request(server)
      .post(`/api/v1/matches/${id}/leave`)
      .set(authHeader(creator.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    rev = lr.body.revision;

    // New creator (admin) can now update the match
    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(admin.token))
      .send({ expectedRevision: rev, title: 'New Title by New Creator' });
    expect(patchRes.status).toBe(200);

    // New creator can cancel
    rev = patchRes.body.revision;
    const cancelRes = await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });
    expect(cancelRes.status).toBe(201);
  });
});
