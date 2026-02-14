import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch, getMatch, randomKey } from './helpers/match.helper';
import { truncateAll } from './helpers/db.helper';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

jest.setTimeout(30_000);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type Server = ReturnType<INestApplication['getHttpServer']>;
type AuthUser = Awaited<ReturnType<typeof createAuthenticatedUser>>;

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

/** Confirm participation; returns full response (may be 201 or 409) */
function confirm(
  server: Server,
  token: string,
  matchId: string,
  rev: number,
  idempotencyKey = randomKey(),
) {
  return request(server)
    .post(`/api/v1/matches/${matchId}/confirm`)
    .set(authHeader(token))
    .set('Idempotency-Key', idempotencyKey)
    .send({ expectedRevision: rev });
}

/** Withdraw participation; returns full response */
function withdraw(server: Server, token: string, matchId: string, rev: number) {
  return request(server)
    .post(`/api/v1/matches/${matchId}/withdraw`)
    .set(authHeader(token))
    .set('Idempotency-Key', randomKey())
    .send({ expectedRevision: rev });
}

/** Query DB directly to count participants by status */
async function countByStatus(
  app: INestApplication,
  matchId: string,
  status: string,
) {
  const prisma = app.get(PrismaService);
  return prisma.client.matchParticipant.count({
    where: { matchId, status: status as never },
  });
}

/** Query DB directly for participants in a match */
async function getParticipants(app: INestApplication, matchId: string) {
  const prisma = app.get(PrismaService);
  return prisma.client.matchParticipant.findMany({
    where: { matchId },
    orderBy: { createdAt: 'asc' },
  });
}

/** Query DB directly for match revision */
async function getMatchRevision(app: INestApplication, matchId: string) {
  const prisma = app.get(PrismaService);
  const m = await prisma.client.match.findUniqueOrThrow({
    where: { id: matchId },
  });
  return m.revision;
}

/* ------------------------------------------------------------------ */
/*  Suite                                                              */
/* ------------------------------------------------------------------ */

describe('Participation Concurrency (e2e)', () => {
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

  /* ================================================================ */
  /*  1) Last slot race                                                */
  /* ================================================================ */
  it('last slot race — confirmedCount never exceeds capacity', async () => {
    const owner = await createAuthenticatedUser(server, 'race-owner');
    const u1 = await createAuthenticatedUser(server, 'race-u1');
    const u2 = await createAuthenticatedUser(server, 'race-u2');
    const u3 = await createAuthenticatedUser(server, 'race-u3');

    const { id } = await createMatch(server, owner.token, { capacity: 2 });

    // Invite all three
    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await invite(server, owner.token, id, u2.userId, rev);
    rev = await invite(server, owner.token, id, u3.userId, rev);

    // u1 confirms (occupies slot 1)
    const c1 = await confirm(server, u1.token, id, rev);
    expect(c1.status).toBe(201);
    rev = c1.body.revision;

    // u2 and u3 race for the last slot (same expectedRevision)
    const [r2, r3] = await Promise.all([
      confirm(server, u2.token, id, rev),
      confirm(server, u3.token, id, rev),
    ]);

    // Exactly one succeeds (201), the other gets 409 REVISION_CONFLICT
    const statuses = [r2.status, r3.status].sort();
    expect(statuses).toEqual([201, 409]);

    // --- DB assertions (source of truth) ---
    const confirmedCount = await countByStatus(app, id, 'CONFIRMED');
    expect(confirmedCount).toBe(2);

    // The winner occupies the last slot; the loser was rejected entirely
    // (didn't get waitlisted because the revision check failed before capacity logic)
    const participants = await getParticipants(app, id);
    const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
    expect(confirmed).toHaveLength(2);

    // confirmedCount never exceeded capacity
    expect(confirmedCount).toBeLessThanOrEqual(2);
  });

  /* ================================================================ */
  /*  2) Double confirm same user concurrent                           */
  /* ================================================================ */
  it('double confirm same user — only one participation row, consistent state', async () => {
    const owner = await createAuthenticatedUser(server, 'dbl-owner');
    const u1 = await createAuthenticatedUser(server, 'dbl-u1');

    const { id } = await createMatch(server, owner.token, { capacity: 5 });
    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);

    // Two concurrent confirms with different idempotency keys, same revision
    const [r1, r2] = await Promise.all([
      confirm(server, u1.token, id, rev),
      confirm(server, u1.token, id, rev),
    ]);

    // Exactly one succeeds, other gets 409 REVISION_CONFLICT
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // --- DB assertions ---
    const participants = await getParticipants(app, id);
    const u1Rows = participants.filter((p) => p.userId === u1.userId);
    // Unique constraint [matchId, userId] ensures only 1 row
    expect(u1Rows).toHaveLength(1);
    expect(u1Rows[0].status).toBe('CONFIRMED');
  });

  /* ================================================================ */
  /*  3) FIFO promotion under race                                     */
  /* ================================================================ */
  it('FIFO promotion — withdraw promotes first waitlisted, not second', async () => {
    const owner = await createAuthenticatedUser(server, 'fifo-owner');
    const u1 = await createAuthenticatedUser(server, 'fifo-u1');
    const u2 = await createAuthenticatedUser(server, 'fifo-u2');
    const u3 = await createAuthenticatedUser(server, 'fifo-u3');

    const { id } = await createMatch(server, owner.token, { capacity: 1 });

    // Invite all
    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await invite(server, owner.token, id, u2.userId, rev);
    rev = await invite(server, owner.token, id, u3.userId, rev);

    // u1 confirms (gets the slot)
    const c1 = await confirm(server, u1.token, id, rev);
    expect(c1.status).toBe(201);
    rev = c1.body.revision;

    // u2 confirms (goes to waitlist #1)
    const c2 = await confirm(server, u2.token, id, rev);
    expect(c2.status).toBe(201);
    rev = c2.body.revision;

    // u3 confirms (goes to waitlist #2)
    const c3 = await confirm(server, u3.token, id, rev);
    expect(c3.status).toBe(201);
    rev = c3.body.revision;

    // Verify initial state
    expect(await countByStatus(app, id, 'CONFIRMED')).toBe(1);
    expect(await countByStatus(app, id, 'WAITLISTED')).toBe(2);

    // Race: u1 withdraws + u2 tries to re-confirm (with new idempotency key)
    // u2's re-confirm is a no-op when already WAITLISTED (returns 201 snapshot
    // without incrementing revision), so both can succeed.
    // If u2's no-op runs first, u1's withdraw still sees the original revision.
    // If u1's withdraw runs first, u2's confirm finds itself already CONFIRMED.
    const [rWithdraw, rConfirm] = await Promise.all([
      withdraw(server, u1.token, id, rev),
      confirm(server, u2.token, id, rev),
    ]);

    // Both may succeed (201) since u2's confirm is idempotent when WAITLISTED
    expect([201, 409]).toContain(rWithdraw.status);
    expect([201, 409]).toContain(rConfirm.status);
    // At least one must succeed
    expect(rWithdraw.status === 201 || rConfirm.status === 201).toBe(true);

    // --- DB assertions ---
    const participants = await getParticipants(app, id);
    const confirmed = participants.filter((p) => p.status === 'CONFIRMED');
    const waitlisted = participants.filter((p) => p.status === 'WAITLISTED');

    // Core invariant: never more confirmed than capacity
    expect(confirmed.length).toBeLessThanOrEqual(1);

    if (rWithdraw.status === 201) {
      // Withdraw succeeded → u1 withdrawn, u2 auto-promoted (FIFO), u3 still waitlisted
      expect(confirmed).toHaveLength(1);
      expect(confirmed[0].userId).toBe(u2.userId);
      expect(waitlisted.some((p) => p.userId === u3.userId)).toBe(true);
    } else {
      // Withdraw got 409 — u1 still CONFIRMED, u2 still WAITLISTED
      expect(confirmed[0].userId).toBe(u1.userId);
    }
  });

  /* ================================================================ */
  /*  4) Withdraw / Confirm interleaving                               */
  /* ================================================================ */
  it('withdraw + confirm interleaving — total confirmed never exceeds capacity', async () => {
    const owner = await createAuthenticatedUser(server, 'intl-owner');
    const u1 = await createAuthenticatedUser(server, 'intl-u1');
    const u2 = await createAuthenticatedUser(server, 'intl-u2');

    const { id } = await createMatch(server, owner.token, { capacity: 1 });

    // Invite both
    let rev = 1;
    rev = await invite(server, owner.token, id, u1.userId, rev);
    rev = await invite(server, owner.token, id, u2.userId, rev);

    // u1 confirms (gets slot)
    const c1 = await confirm(server, u1.token, id, rev);
    expect(c1.status).toBe(201);
    rev = c1.body.revision;

    // Race: u1 withdraws and u2 confirms simultaneously (same revision)
    const [rW, rC] = await Promise.all([
      withdraw(server, u1.token, id, rev),
      confirm(server, u2.token, id, rev),
    ]);

    const outcomes = [rW.status, rC.status].sort();
    expect(outcomes).toEqual([201, 409]);

    // --- DB assertions ---
    const confirmedCount = await countByStatus(app, id, 'CONFIRMED');
    // Invariant: at most 1 confirmed
    expect(confirmedCount).toBeLessThanOrEqual(1);

    const participants = await getParticipants(app, id);
    const confirmed = participants.filter((p) => p.status === 'CONFIRMED');

    if (rW.status === 201) {
      // Withdraw succeeded: u1 withdrawn, no auto-promote for u2 (still INVITED)
      // u2's confirm got 409
      // But u2 was INVITED not WAITLISTED, so no auto-promotion from withdraw
      expect(confirmedCount).toBe(0);
    } else {
      // u2's confirm succeeded first: u2 waitlisted (capacity full) or confirmed
      // Depends on timing — but either way invariant holds
      expect(confirmedCount).toBeLessThanOrEqual(1);
    }

    // Core invariant
    expect(confirmed.length).toBeLessThanOrEqual(1);
  });

  /* ================================================================ */
  /*  5) Optimistic locking race on PATCH                              */
  /* ================================================================ */
  it('concurrent PATCH — exactly one 200, one 409 REVISION_CONFLICT', async () => {
    const owner = await createAuthenticatedUser(server, 'lock-owner');
    const { id, revision } = await createMatch(server, owner.token);

    // Two PATCHes with the same revision in parallel
    const [r1, r2] = await Promise.all([
      request(server)
        .patch(`/api/v1/matches/${id}`)
        .set(authHeader(owner.token))
        .send({ expectedRevision: revision, title: 'Update A' }),
      request(server)
        .patch(`/api/v1/matches/${id}`)
        .set(authHeader(owner.token))
        .send({ expectedRevision: revision, title: 'Update B' }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // The 409 response must contain REVISION_CONFLICT code
    const conflictRes = r1.status === 409 ? r1 : r2;
    expect(conflictRes.body.code).toBe('REVISION_CONFLICT');

    // --- DB assertions ---
    const finalRev = await getMatchRevision(app, id);
    // Revision incremented exactly once (from initial)
    expect(finalRev).toBe(revision + 1);

    // Verify the winning change stuck
    const winnerRes = r1.status === 200 ? r1 : r2;
    const snap = await getMatch(server, owner.token, id);
    expect(snap.body.match.title).toBe(winnerRes.body.title);
  });

  /* ================================================================ */
  /*  Stress: many concurrent confirms                                 */
  /* ================================================================ */
  it('stress — 5 users race to confirm capacity=3, never exceed capacity', async () => {
    const owner = await createAuthenticatedUser(server, 'stress-owner');
    const users: AuthUser[] = [];
    for (let i = 0; i < 5; i++) {
      users.push(await createAuthenticatedUser(server, `stress-u${i}`));
    }

    const { id } = await createMatch(server, owner.token, { capacity: 3 });

    // Invite all sequentially (each increments revision)
    let rev = 1;
    for (const u of users) {
      rev = await invite(server, owner.token, id, u.userId, rev);
    }

    // All 5 try to confirm with the SAME revision (race)
    const results = await Promise.all(
      users.map((u) => confirm(server, u.token, id, rev)),
    );

    // Exactly one should succeed (201), rest get 409
    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(4);

    // --- DB assertions ---
    const confirmedCount = await countByStatus(app, id, 'CONFIRMED');
    expect(confirmedCount).toBeLessThanOrEqual(3);
    // Only 1 actually got through
    expect(confirmedCount).toBe(1);
  });
});
