import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { createAuthenticatedUser, authHeader } from './helpers/auth.helper';
import { truncateAll } from './helpers/db.helper';

describe('Users Lookup (e2e)', () => {
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

  it('register auto-generates username from email', async () => {
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({ email: 'facu@test.com', password: 'Test1234!' });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('facu');
  });

  it('register accepts explicit username', async () => {
    const res = await request(server).post('/api/v1/auth/register').send({
      email: 'x@test.com',
      password: 'Test1234!',
      username: 'custom_user',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('custom_user');
  });

  it('register auto-generates unique username on collision', async () => {
    // First user takes "player"
    await request(server)
      .post('/api/v1/auth/register')
      .send({ email: 'player@a.com', password: 'Test1234!' });

    // Second user with same local part gets "player2"
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({ email: 'player@b.com', password: 'Test1234!' });

    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('player2');
  });

  it('lookup by username returns user DTO', async () => {
    // Register and capture the auto-generated username from response
    const email = 'lookup1@test.com';
    const regRes = await request(server)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Test1234!' });
    expect(regRes.status).toBe(201);
    const user = {
      token: regRes.body.accessToken as string,
      userId: regRes.body.user.id as string,
      username: regRes.body.user.username as string,
      email,
    };

    const res = await request(server)
      .get('/api/v1/users/lookup')
      .query({ query: user.username })
      .set(authHeader(user.token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.userId);
    expect(res.body.username).toBeDefined();
    expect(res.body.email).toBe(user.email);
    // Must NOT expose sensitive fields
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('lookup by email returns user DTO', async () => {
    const user = await createAuthenticatedUser(server, 'lookup2');

    const res = await request(server)
      .get('/api/v1/users/lookup')
      .query({ query: user.email })
      .set(authHeader(user.token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.userId);
    expect(res.body.email).toBe(user.email);
  });

  it('lookup returns 404 for non-existent user', async () => {
    const user = await createAuthenticatedUser(server, 'lookup3');

    const res = await request(server)
      .get('/api/v1/users/lookup')
      .query({ query: 'nonexistent_user' })
      .set(authHeader(user.token));

    expect(res.status).toBe(404);
  });

  it('lookup requires JWT', async () => {
    const res = await request(server)
      .get('/api/v1/users/lookup')
      .query({ query: 'someone' });

    expect(res.status).toBe(401);
  });

  it('/me returns username', async () => {
    const user = await createAuthenticatedUser(server, 'me1');

    const res = await request(server)
      .get('/api/v1/me')
      .set(authHeader(user.token));

    expect(res.status).toBe(200);
    expect(res.body.username).toBeDefined();
    expect(typeof res.body.username).toBe('string');
  });
});
