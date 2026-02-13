import request from 'supertest';
import type { Server } from 'http';

export function registerUser(server: Server, email: string, password: string) {
  return request(server)
    .post('/api/v1/auth/register')
    .send({ email, password });
}

export function loginUser(server: Server, email: string, password: string) {
  return request(server).post('/api/v1/auth/login').send({ email, password });
}

export async function createAuthenticatedUser(
  server: Server,
  suffix = Math.random().toString(36).slice(2, 8),
) {
  const email = `e2e-${suffix}@test.com`;
  const password = 'Test1234!';

  const res = await registerUser(server, email, password);
  expect(res.status).toBe(201);

  return {
    token: res.body.accessToken as string,
    userId: res.body.user.id as string,
    email,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
