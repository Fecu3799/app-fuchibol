import { randomUUID } from 'crypto';
import request from 'supertest';
import type { Server } from 'http';
import { authHeader } from './auth.helper';

const defaultMatch = {
  title: 'E2E Test Match',
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  capacity: 10,
};

export async function createMatch(
  server: Server,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(server)
    .post('/api/v1/matches')
    .set(authHeader(token))
    .send({ ...defaultMatch, ...overrides });

  expect(res.status).toBe(201);
  return {
    id: res.body.id as string,
    revision: res.body.revision as number,
  };
}

export function getMatch(server: Server, token: string, matchId: string) {
  return request(server)
    .get(`/api/v1/matches/${matchId}`)
    .set(authHeader(token));
}

export function randomKey() {
  return randomUUID();
}
