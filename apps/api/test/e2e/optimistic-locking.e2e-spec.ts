import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { createMatch } from './helpers/match.helper';
import { expectError } from './helpers/assertions';
import { truncateAll } from './helpers/db.helper';

describe('Optimistic Locking (e2e)', () => {
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

  it('PATCH with correct revision → 200', async () => {
    const { token } = await createAuthenticatedUser(server);
    const { id, revision } = await createMatch(server, token);

    const res = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(token))
      .send({ expectedRevision: revision, title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.revision).toBe(revision + 1);
  });

  it('PATCH with stale revision → 409 REVISION_CONFLICT', async () => {
    const { token } = await createAuthenticatedUser(server);
    const { id, revision } = await createMatch(server, token);

    // First update succeeds
    await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(token))
      .send({ expectedRevision: revision, title: 'First Update' });

    // Second update with stale revision
    const res = await request(server)
      .patch(`/api/v1/matches/${id}`)
      .set(authHeader(token))
      .send({ expectedRevision: revision, title: 'Stale Update' });

    expectError(res, { status: 409, code: 'REVISION_CONFLICT' });
  });
});
