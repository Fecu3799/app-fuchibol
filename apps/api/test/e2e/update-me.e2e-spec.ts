import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { truncateAll } from './helpers/db.helper';

describe('PATCH /me (e2e)', () => {
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

  it('updates profile fields and returns updated user', async () => {
    const user = await createAuthenticatedUser(app, 'patchme1');

    const res = await request(server)
      .patch('/api/v1/me')
      .set(authHeader(user.token))
      .send({
        firstName: 'Juan',
        lastName: 'García',
        gender: 'MALE',
        preferredPosition: 'MIDFIELDER',
        skillLevel: 'AMATEUR',
      });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Juan');
    expect(res.body.lastName).toBe('García');
    expect(res.body.gender).toBe('MALE');
    expect(res.body.preferredPosition).toBe('MIDFIELDER');
    expect(res.body.skillLevel).toBe('AMATEUR');
    expect(res.body.email).toBeDefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('can clear nullable fields by passing null', async () => {
    const user = await createAuthenticatedUser(app, 'patchme2');

    // First set a firstName
    await request(server)
      .patch('/api/v1/me')
      .set(authHeader(user.token))
      .send({ firstName: 'Juan' });

    // Then clear it
    const res = await request(server)
      .patch('/api/v1/me')
      .set(authHeader(user.token))
      .send({ firstName: null });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBeNull();
  });

  it('returns 401 without JWT', async () => {
    const res = await request(server)
      .patch('/api/v1/me')
      .send({ firstName: 'Juan' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid enum value', async () => {
    const user = await createAuthenticatedUser(app, 'patchme3');

    const res = await request(server)
      .patch('/api/v1/me')
      .set(authHeader(user.token))
      .send({ gender: 'INVALID_GENDER' });

    expect(res.status).toBe(422);
  });

  it('rejects unknown fields like email (forbidNonWhitelisted)', async () => {
    const user = await createAuthenticatedUser(app, 'patchme4');

    const res = await request(server)
      .patch('/api/v1/me')
      .set(authHeader(user.token))
      .send({ firstName: 'Test', email: 'hacker@evil.com' });

    // email is not in UpdateMeDto — server rejects with 422 due to forbidNonWhitelisted
    expect(res.status).toBe(422);
  });
});
