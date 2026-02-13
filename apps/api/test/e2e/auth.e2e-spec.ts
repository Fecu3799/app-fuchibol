import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createE2eApp } from './helpers/bootstrap';
import { registerUser, loginUser, authHeader } from './helpers/auth.helper';
import { expectError, expectRequestId } from './helpers/assertions';
import { truncateAll } from './helpers/db.helper';

describe('Auth (e2e)', () => {
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

  const email = 'auth-test@test.com';
  const password = 'Test1234!';

  it('POST /auth/register → 201 with accessToken and user', async () => {
    const res = await registerUser(server, email, password);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      email,
      role: 'USER',
    });
    expectRequestId(res);
  });

  it('POST /auth/login → 201 with accessToken', async () => {
    await registerUser(server, email, password);
    const res = await loginUser(server, email, password);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('GET /me with token → 200', async () => {
    const reg = await registerUser(server, email, password);
    const token = reg.body.accessToken;

    const res = await request(server).get('/api/v1/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body.id).toBeDefined();
  });

  it('GET /me without token → 401 UNAUTHORIZED', async () => {
    const res = await request(server).get('/api/v1/me');

    expectError(res, { status: 401, code: 'UNAUTHORIZED' });
  });
});
