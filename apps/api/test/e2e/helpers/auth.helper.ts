import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { verifyEmailInDb } from './db.helper';

export function registerUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  password: string,
  username?: string,
) {
  return request(server)
    .post('/api/v1/auth/register')
    .send({
      email,
      password,
      acceptTerms: true,
      ...(username ? { username } : {}),
    });
}

export function loginUser(
  server: ReturnType<INestApplication['getHttpServer']>,
  identifier: string,
  password: string,
) {
  return request(server)
    .post('/api/v1/auth/login')
    .send({ identifier, password });
}

export async function createAuthenticatedUser(
  app: INestApplication,
  suffix = Math.random().toString(36).slice(2, 8),
) {
  const server = app.getHttpServer();
  const email = `e2e-${suffix}@test.com`;
  const password = 'Test1234!';

  const reg = await registerUser(server, email, password);
  expect(reg.status).toBe(201);

  await verifyEmailInDb(app, email);

  const login = await loginUser(server, email, password);
  expect(login.status).toBe(201);

  return {
    token: login.body.accessToken as string,
    refreshToken: login.body.refreshToken as string,
    userId: login.body.user.id as string,
    email,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
