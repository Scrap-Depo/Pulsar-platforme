import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp as clientApp, deleteApp as deleteClient } from 'firebase/app';
import { getAuth as clientAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { createService } from '../functions/service.mjs';
import { createHttpHandler } from '../server/http-handler.mjs';

if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8185' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') {
  throw new Error('Only run with the local Firestore and Auth emulators.');
}

test('HTTP API: real emulator tokens, ownership, accepted response and safe retry', async () => {
  const app = initializeApp({ projectId: 'demo-pulsar' }, 'http-test');
  const db = getFirestore(app), auth = getAuth(app);
  const handler = createHttpHandler(() => ({ auth, execute: createService(db) }));
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = body;
    res.status = (status) => { res.statusCode = status; return res; };
    res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    await handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const apps = [], users = [];
  let sid;
  async function identity(anonymous = false) {
    const c = clientApp({ projectId: 'demo-pulsar', apiKey: 'demo-key' }, `http-${apps.length}-${Date.now()}`);
    apps.push(c);
    const a = clientAuth(c);
    connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
    const { user } = anonymous ? await signInAnonymously(a) :
      await createUserWithEmailAndPassword(a, `http-${apps.length}-${Date.now()}@example.test`, 'test-password-123');
    users.push(user.uid);
    return { uid: user.uid, token: await user.getIdToken() };
  }
  async function call(identity, action, data = {}) {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, action }) });
    return { status: r.status, ...(await r.json()) };
  }
  try {
    const host = await identity(), other = await identity(), participant = await identity(true);
    const create = { requestId: `http-${Date.now()}`, title: 'HTTP test', slides: [{ id: 'slide', type: 'pulse', title: 'Оценка', minLabel: 'Мало', maxLabel: 'Много' }] };
    assert.equal((await call({ token: 'forged' }, 'create', create)).status, 401);
    assert.equal((await call(participant, 'create', { ...create, uid: host.uid, provider: 'password' })).status, 400);
    const meeting = await call(host, 'create', create);
    assert.equal(meeting.status, 200);
    sid = meeting.data.id;
    assert.equal((await call(other, 'delete', { sessionId: sid, uid: host.uid })).status, 400);
    assert.equal((await call(participant, 'join', { code: meeting.data.joinCode })).status, 200);
    const rid = `round-${Date.now()}`;
    assert.equal((await call(host, 'open', { sessionId: sid, slideId: 'slide', requestId: rid, settings: {} })).status, 200);
    const submission = { sessionId: sid, roundId: rid, requestId: 'response-1', revision: 0, slot: 0, value: 7 };
    assert.equal((await call(participant, 'submit', submission)).status, 200);
    assert.equal((await call(host, 'close', { sessionId: sid, roundId: rid })).status, 200);
    assert.equal((await call(participant, 'submit', submission)).status, 200);
    assert.equal((await db.collection(`meetings/${sid}/rounds/${rid}/responses`).get()).size, 1);
    assert.equal((await call(host, 'delete', { sessionId: sid })).status, 200);
    assert.equal((await db.doc(`meetings/${sid}`).get()).exists, false);
    sid = undefined;
  } finally {
    if (sid) {
      const meeting = await db.doc(`meetings/${sid}`).get();
      if (meeting.exists) await db.doc(`joinCodes/${meeting.data().joinCode}`).delete();
      await db.recursiveDelete(db.doc(`meetings/${sid}`));
      await db.doc(`rooms/${sid}`).delete();
    }
    await Promise.all(users.map(uid => auth.deleteUser(uid)));
    await Promise.all(apps.map(deleteClient));
    await new Promise(resolve => server.close(resolve));
    await db.terminate();
    await deleteApp(app);
  }
});
