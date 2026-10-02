import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHttpHandler } from '../server/http-handler.mjs';

async function request(handler, body, authorization = 'Bearer valid', method = 'POST') {
  const result = { headers: {} };
  await handler({ method, headers: { authorization }, body }, {
    setHeader(k, v) { result.headers[k] = v; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  });
  return result;
}

test('HTTP boundary rejects invalid requests and trusts verified identity only', async () => {
  const calls = [];
  const handler = createHttpHandler(() => ({
    auth: { async verifyIdToken(token, revoked) {
      assert.equal(revoked, true);
      if (token !== 'valid') throw new Error('secret auth detail');
      return { uid: 'verified-user', firebase: { sign_in_provider: 'anonymous' } };
    } },
    async execute(...args) { calls.push(args); return { accepted: true }; },
  }));
  assert.equal((await request(handler, {}, '', 'GET')).status, 405);
  assert.equal((await request(handler, { action: 'create' }, '')).status, 401);
  assert.equal((await request(handler, { action: 'create' }, 'Bearer forged')).status, 401);
  assert.equal((await request(handler, '{')).status, 400);
  assert.equal((await request(handler, { action: 'create', value: 'x'.repeat(131072) })).status, 413);
  assert.equal(calls.length, 0);
  const response = await request(handler, { action: 'create', uid: 'owner', provider: 'password' });
  assert.equal(response.status, 200);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.deepEqual(calls[0].slice(0, 2), ['verified-user', 'anonymous']);
});

test('HTTP boundary reports missing configuration and hides storage internals', async () => {
  const missing = createHttpHandler(() => { throw new Error('private-key-value'); });
  const response = await request(missing, { action: 'create' });
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response).includes('private-key-value'));
  const unavailable = createHttpHandler(() => ({
    auth: { async verifyIdToken() { return { uid: 'host' }; } },
    async execute() { throw Object.assign(new Error('private database detail'), { code: 14 }); },
  }));
  const failure = await request(unavailable, { action: 'create' });
  assert.equal(failure.status, 503);
  assert.ok(!JSON.stringify(failure).includes('private database detail'));
});
