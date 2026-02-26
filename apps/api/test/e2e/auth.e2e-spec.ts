import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { requestIdMiddleware } from '../../src/common/middleware/request-id.middleware';
import { EmailService } from '../../src/auth/infra/email.service';
import {
  registerUser,
  loginUser,
  createAuthenticatedUser,
  authHeader,
} from './helpers/auth.helper';
import { expectError, expectRequestId } from './helpers/assertions';
import { truncateAll, verifyEmailInDb } from './helpers/db.helper';

/** Email service that captures the last sent token for e2e inspection. */
class CaptureEmailService extends EmailService {
  lastTo: string | null = null;
  lastToken: string | null = null;

  sendEmailVerification(to: string, token: string): Promise<void> {
    this.lastTo = to;
    this.lastToken = token;
    return Promise.resolve();
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let captureEmail: CaptureEmailService;

  const email = 'auth-test@test.com';
  const password = 'Test1234!';

  beforeAll(async () => {
    captureEmail = new CaptureEmailService();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(captureEmail)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(requestIdMiddleware);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await truncateAll(app);
    captureEmail.lastToken = null;
    captureEmail.lastTo = null;
  });

  afterAll(async () => {
    await app.close();
  });

  // --- Register ---

  it('POST /auth/register → 201 with message and user (no accessToken)', async () => {
    const res = await registerUser(server, email, password);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.message).toBeDefined();
    expect(res.body.user).toMatchObject({
      id: expect.any(String),
      email,
    });
    expectRequestId(res);
  });

  it('POST /auth/register → sends email verification token', async () => {
    await registerUser(server, email, password);

    expect(captureEmail.lastTo).toBe(email);
    expect(captureEmail.lastToken).toBeTruthy();
  });

  it('POST /auth/register → 409 on duplicate email', async () => {
    await registerUser(server, email, password);
    const res = await registerUser(server, email, password);

    expectError(res, { status: 409, code: 'CONFLICT' });
  });

  // --- Email verification ---

  it('POST /auth/email/verify/confirm → 204 with valid token', async () => {
    await registerUser(server, email, password);
    const token = captureEmail.lastToken!;

    const res = await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token });

    expect(res.status).toBe(204);
  });

  it('POST /auth/email/verify/confirm → 401 with invalid token', async () => {
    const res = await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token: 'invalid-token-000' });

    expectError(res, { status: 401, code: 'UNAUTHORIZED' });
  });

  it('POST /auth/email/verify/confirm → 401 when token already used', async () => {
    await registerUser(server, email, password);
    const token = captureEmail.lastToken!;

    await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token });

    // Second use
    const res = await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token });

    expectError(res, { status: 401, code: 'UNAUTHORIZED' });
  });

  // --- Login ---

  it('POST /auth/login → 403 EMAIL_NOT_VERIFIED before verification', async () => {
    await registerUser(server, email, password);
    const res = await loginUser(server, email, password);

    expectError(res, { status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('POST /auth/login by email → 201 with accessToken + refreshToken after verification', async () => {
    await registerUser(server, email, password);
    await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token: captureEmail.lastToken });

    const res = await loginUser(server, email, password);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('POST /auth/login by username → 201 after verification', async () => {
    const regRes = await registerUser(server, email, password);
    const username = regRes.body.user.username as string;
    await request(server)
      .post('/api/v1/auth/email/verify/confirm')
      .send({ token: captureEmail.lastToken });

    const res = await loginUser(server, username, password);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('POST /auth/login → 401 on wrong password', async () => {
    await registerUser(server, email, password);
    await verifyEmailInDb(app, email);

    const res = await loginUser(server, email, 'wrong-password');

    expectError(res, { status: 401, code: 'UNAUTHORIZED' });
  });

  // --- Refresh ---

  it('POST /auth/refresh → 200 with new tokens', async () => {
    const { refreshToken } = await createAuthenticatedUser(app, 'rfr1');

    const res = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('POST /auth/refresh → 401 REFRESH_REUSED on token reuse', async () => {
    const { refreshToken } = await createAuthenticatedUser(app, 'rfr2');

    // First use is valid
    await request(server).post('/api/v1/auth/refresh').send({ refreshToken });

    // Reuse of old token
    const res = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expectError(res, { status: 401, code: 'REFRESH_REUSED' });
  });

  // --- Logout ---

  it('POST /auth/logout → 204 revokes current session', async () => {
    const { token, refreshToken } = await createAuthenticatedUser(app, 'lgout');

    const logoutRes = await request(server)
      .post('/api/v1/auth/logout')
      .set(authHeader(token));
    expect(logoutRes.status).toBe(204);

    // Refresh should fail after logout
    const res = await request(server)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });
    expectError(res, { status: 401, code: 'SESSION_REVOKED' });
  });

  it('POST /auth/logout-all → 204 revokes all sessions', async () => {
    const { token } = await createAuthenticatedUser(app, 'lgall');

    const res = await request(server)
      .post('/api/v1/auth/logout-all')
      .set(authHeader(token));

    expect(res.status).toBe(204);
  });

  // --- Sessions ---

  it('GET /auth/sessions → 200 lists active sessions', async () => {
    const { token } = await createAuthenticatedUser(app, 'sess1');

    const res = await request(server)
      .get('/api/v1/auth/sessions')
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('DELETE /auth/sessions/:id → 204 revokes that session', async () => {
    const { token, userId: _userId } = await createAuthenticatedUser(
      app,
      'sess2',
    );

    const sessionsRes = await request(server)
      .get('/api/v1/auth/sessions')
      .set(authHeader(token));
    const sessionId = sessionsRes.body[0].id as string;

    const res = await request(server)
      .delete(`/api/v1/auth/sessions/${sessionId}`)
      .set(authHeader(token));

    expect(res.status).toBe(204);
  });

  // --- /me ---

  it('GET /me with valid token → 200', async () => {
    const { token } = await createAuthenticatedUser(app, 'me1');

    const res = await request(server).get('/api/v1/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.email).toContain('me1');
    expect(res.body.id).toBeDefined();
  });

  it('GET /me without token → 401 UNAUTHORIZED', async () => {
    const res = await request(server).get('/api/v1/me');

    expectError(res, { status: 401, code: 'UNAUTHORIZED' });
  });
});
