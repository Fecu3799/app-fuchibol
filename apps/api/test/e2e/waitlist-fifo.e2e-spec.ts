import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';

async function inviteAndConfirm(
  server: ReturnType<INestApplication['getHttpServer']>,
  matchId: string,
  ownerToken: string,
  userToken: string,
  userId: string,
  revision: number,
) {
  const invRes = await request(server)
    .post(`/api/v1/matches/${matchId}/invite`)
    .set({ Authorization: `Bearer ${ownerToken}` })
    .set('Idempotency-Key', randomKey())
    .send({ expectedRevision: revision, userId });

  const rev = invRes.body.revision;

  const confRes = await request(server)
    .post(`/api/v1/matches/${matchId}/confirm`)
    .set({ Authorization: `Bearer ${userToken}` })
    .set('Idempotency-Key', randomKey())
    .send({ expectedRevision: rev });

  return confRes.body.revision as number;
}

describe('Waitlist FIFO (e2e)', () => {
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

  it('capacity 2: a,b confirm → c,d waitlisted → a withdraws → c promoted', async () => {
    const owner = await createAuthenticatedUser(server, 'wl-owner');
    const a = await createAuthenticatedUser(server, 'wl-a');
    const b = await createAuthenticatedUser(server, 'wl-b');
    const c = await createAuthenticatedUser(server, 'wl-c');
    const d = await createAuthenticatedUser(server, 'wl-d');

    const { id } = await createMatch(server, owner.token, { capacity: 2 });

    // Invite and confirm a (gets slot)
    let rev = 1;
    rev = await inviteAndConfirm(
      server,
      id,
      owner.token,
      a.token,
      a.userId,
      rev,
    );

    // Invite and confirm b (gets slot)
    rev = await inviteAndConfirm(
      server,
      id,
      owner.token,
      b.token,
      b.userId,
      rev,
    );

    // Invite and confirm c (waitlisted)
    rev = await inviteAndConfirm(
      server,
      id,
      owner.token,
      c.token,
      c.userId,
      rev,
    );

    // Invite and confirm d (waitlisted)
    rev = await inviteAndConfirm(
      server,
      id,
      owner.token,
      d.token,
      d.userId,
      rev,
    );

    // Verify: 2 confirmed, c and d waitlisted
    let snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.confirmedCount).toBe(2);
    expect(snap.body.match.waitlist.length).toBe(2);

    // a withdraws
    const withdrawRes = await request(server)
      .post(`/api/v1/matches/${id}/withdraw`)
      .set(authHeader(a.token))
      .set('Idempotency-Key', randomKey())
      .send({ expectedRevision: rev });

    expect(withdrawRes.status).toBe(201);

    // Verify: c promoted, d still waitlisted
    snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.confirmedCount).toBe(2);
    expect(snap.body.match.waitlist.length).toBe(1);

    // c should be in participants (confirmed), d in waitlist
    const confirmedIds = snap.body.match.participants
      .filter((p: { status: string }) => p.status === 'CONFIRMED')
      .map((p: { userId: string }) => p.userId);
    const waitlistedIds = snap.body.match.waitlist.map(
      (p: { userId: string }) => p.userId,
    );

    expect(confirmedIds).toContain(c.userId);
    expect(confirmedIds).toContain(b.userId);
    expect(waitlistedIds).toContain(d.userId);
  });
});
