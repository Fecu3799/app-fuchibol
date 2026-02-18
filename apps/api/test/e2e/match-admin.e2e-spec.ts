import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';
import { expectError } from './helpers/assertions';

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

describe('Match Admin (e2e)', () => {
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

  it('creator promotes participant to matchAdmin', async () => {
    const creator = await createAuthenticatedUser(server, 'adm-creator');
    const user = await createAuthenticatedUser(server, 'adm-user');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, user.userId, rev);
    rev = await confirm(server, user.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: user.userId, expectedRevision: rev });

    expect(promoteRes.status).toBe(201);
    rev = promoteRes.body.revision;

    // Verify participant has isMatchAdmin=true
    const snap = await getMatch(server, creator.token, id);
    const participant = snap.body.match.participants.find(
      (p: { userId: string }) => p.userId === user.userId,
    );
    expect(participant.isMatchAdmin).toBe(true);
  });

  it('promote is idempotent (already admin)', async () => {
    const creator = await createAuthenticatedUser(server, 'idm-creator');
    const user = await createAuthenticatedUser(server, 'idm-user');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, user.userId, rev);
    rev = await confirm(server, user.token, id, rev);

    // First promote
    const res1 = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: user.userId, expectedRevision: rev });
    expect(res1.status).toBe(201);
    rev = res1.body.revision;

    // Second promote (idempotent, no revision bump)
    const res2 = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: user.userId, expectedRevision: rev });
    expect(res2.status).toBe(201);
    expect(res2.body.revision).toBe(rev); // no bump
  });

  it('matchAdmin can invite', async () => {
    const creator = await createAuthenticatedUser(server, 'inv-creator');
    const admin = await createAuthenticatedUser(server, 'inv-admin');
    const target = await createAuthenticatedUser(server, 'inv-target');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    // Promote admin
    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    // Admin invites target
    const inviteRes = await request(server)
      .post(`/api/v1/matches/${id}/invite`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev, userId: target.userId });

    expect(inviteRes.status).toBe(201);
  });

  it('matchAdmin can lock and unlock', async () => {
    const creator = await createAuthenticatedUser(server, 'lk-creator');
    const admin = await createAuthenticatedUser(server, 'lk-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    // Admin locks
    const lockRes = await request(server)
      .post(`/api/v1/matches/${id}/lock`)
      .set(authHeader(admin.token))
      .send({ expectedRevision: rev });
    expect(lockRes.status).toBe(201);
    rev = lockRes.body.revision;

    // Admin unlocks
    const unlockRes = await request(server)
      .post(`/api/v1/matches/${id}/unlock`)
      .set(authHeader(admin.token))
      .send({ expectedRevision: rev });
    expect(unlockRes.status).toBe(201);
  });

  it('matchAdmin cannot patch/edit → 403', async () => {
    const creator = await createAuthenticatedUser(server, 'ed-creator');
    const admin = await createAuthenticatedUser(server, 'ed-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    const patchRes = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(admin.token))
      .send({ expectedRevision: rev, title: 'Hacked Title' });

    expect(patchRes.status).toBe(403);
  });

  it('matchAdmin cannot cancel → 403', async () => {
    const creator = await createAuthenticatedUser(server, 'cn-creator');
    const admin = await createAuthenticatedUser(server, 'cn-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    const cancelRes = await request(server)
      .post(`/api/v1/matches/${id}/cancel`)
      .set(authHeader(admin.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(cancelRes.status).toBe(403);
  });

  it('matchAdmin cannot promote/demote → 403', async () => {
    const creator = await createAuthenticatedUser(server, 'pm-creator');
    const admin = await createAuthenticatedUser(server, 'pm-admin');
    const target = await createAuthenticatedUser(server, 'pm-target');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);
    rev = await invite(server, creator.token, id, target.userId, rev);
    rev = await confirm(server, target.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    // Admin tries to promote target
    const promoteRes2 = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(admin.token))
      .send({ userId: target.userId, expectedRevision: rev });
    expect(promoteRes2.status).toBe(403);
  });

  it('creator demotes admin', async () => {
    const creator = await createAuthenticatedUser(server, 'dm-creator');
    const admin = await createAuthenticatedUser(server, 'dm-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    const demoteRes = await request(server)
      .delete(`/api/v1/matches/${id}/admins/${admin.userId}`)
      .set(authHeader(creator.token))
      .send({ expectedRevision: rev });
    expect(demoteRes.status).toBe(200);

    // Verify no longer admin
    const snap = await getMatch(server, creator.token, id);
    const participant = snap.body.match.participants.find(
      (p: { userId: string }) => p.userId === admin.userId,
    );
    expect(participant.isMatchAdmin).toBe(false);
  });

  it('cannot demote creator → 422 CANNOT_DEMOTE_CREATOR', async () => {
    const creator = await createAuthenticatedUser(server, 'dc-creator');
    const { id } = await createMatch(server, creator.token);

    const demoteRes = await request(server)
      .delete(`/api/v1/matches/${id}/admins/${creator.userId}`)
      .set(authHeader(creator.token))
      .send({ expectedRevision: 1 });

    expectError(demoteRes, { status: 422, code: 'CANNOT_DEMOTE_CREATOR' });
  });

  it('promote non-participant → 422 NOT_PARTICIPANT', async () => {
    const creator = await createAuthenticatedUser(server, 'np-creator');
    const outsider = await createAuthenticatedUser(server, 'np-outsider');
    const { id } = await createMatch(server, creator.token);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: outsider.userId, expectedRevision: 1 });

    expectError(promoteRes, { status: 422, code: 'NOT_PARTICIPANT' });
  });

  it('actionsAllowed includes manage_admins for creator only', async () => {
    const creator = await createAuthenticatedUser(server, 'aa-creator');
    const admin = await createAuthenticatedUser(server, 'aa-admin');
    const { id } = await createMatch(server, creator.token);

    let rev = 1;
    rev = await invite(server, creator.token, id, admin.userId, rev);
    rev = await confirm(server, admin.token, id, rev);

    const promoteRes = await request(server)
      .post(`/api/v1/matches/${id}/admins`)
      .set(authHeader(creator.token))
      .send({ userId: admin.userId, expectedRevision: rev });
    rev = promoteRes.body.revision;

    // Creator sees manage_admins
    const creatorSnap = await getMatch(server, creator.token, id);
    expect(creatorSnap.body.match.actionsAllowed).toContain('manage_admins');
    expect(creatorSnap.body.match.actionsAllowed).toContain('invite');

    // Admin sees invite but not manage_admins
    const adminSnap = await getMatch(server, admin.token, id);
    expect(adminSnap.body.match.actionsAllowed).toContain('invite');
    expect(adminSnap.body.match.actionsAllowed).not.toContain('manage_admins');
    expect(adminSnap.body.match.actionsAllowed).not.toContain('update');
    expect(adminSnap.body.match.actionsAllowed).not.toContain('cancel');
  });
});
