import type { Response } from 'supertest';

export function expectError(
  res: Response,
  opts: { status: number; code: string },
) {
  expect(res.status).toBe(opts.status);
  expect(res.body).toMatchObject({
    type: 'about:blank',
    status: opts.status,
    code: opts.code,
  });
  expect(res.body.title).toBeDefined();
  expect(res.body.requestId).toBeDefined();
  expectRequestId(res);
}

export function expectRequestId(res: Response) {
  expect(res.headers['x-request-id']).toBeDefined();
}
