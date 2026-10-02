import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8185', 'Local emulator only.');
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pulsar-transition',
    firestore: {
      host: '127.0.0.1',
      port: 8185,
      rules: readFileSync('deployment/pulsar-5692c/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const records = {
      'sessions/legacy': { ownerUid: 'old-host', title: 'Старый пульт' },
      'meetings/new': { ownerUid: 'new-host', status: 'live' },
      'rooms/new': { title: 'Новая встреча', status: 'live' },
      'meetings/new/members/member': { id: 'member' },
      'meetings/new/rounds/r': { visible: false, phase: 'open' },
      'meetings/new/rounds/r/private/member': { answers: { 0: { value: 'Мой ответ' } } },
      'meetings/new/rounds/r/responses/a': { participantId: 'member', value: 'Мой ответ' },
      'meetings/new/rounds/r/published/a': { value: 'Скрыто до раскрытия' },
    };
    await Promise.all(Object.entries(records).map(([path, value]) => setDoc(doc(db, path), value)));
  });
});
after(async () => {
  await env?.cleanup();
});

test('legacy session access remains unchanged and does not extend to v2', async () => {
  const db = env.authenticatedContext('old-host').firestore();
  await assertSucceeds(getDoc(doc(db, 'sessions/legacy')));
  await assertSucceeds(updateDoc(doc(db, 'sessions/legacy'), { title: 'Старый пульт работает' }));
  await assertSucceeds(setDoc(doc(db, 'sessions/another'), { ownerUid: 'old-host' }));
  await assertFails(setDoc(doc(db, 'sessions/spoof'), { ownerUid: 'someone-else' }));
  await assertFails(getDoc(doc(db, 'meetings/new')));
  await assertFails(getDoc(doc(db, 'rooms/new')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'sessions/legacy')));
  const participant = env.authenticatedContext('legacy-participant').firestore();
  await assertSucceeds(
    setDoc(doc(participant, 'sessions/legacy/participants/p'), { joined: true }),
  );
  await assertSucceeds(setDoc(doc(participant, 'sessions/legacy/responses/r'), { value: 1 }));
  await assertFails(updateDoc(doc(participant, 'sessions/legacy'), { title: 'Чужая правка' }));
});

test('v2 private answers and hidden results remain isolated under transition rules', async () => {
  const member = env.authenticatedContext('member').firestore();
  const other = env.authenticatedContext('other').firestore();
  const host = env.authenticatedContext('new-host').firestore();
  await assertSucceeds(getDoc(doc(member, 'rooms/new')));
  await assertSucceeds(getDoc(doc(member, 'meetings/new/rounds/r/private/member')));
  await assertFails(getDoc(doc(other, 'meetings/new/rounds/r/private/member')));
  await assertFails(getDocs(collection(member, 'meetings/new/rounds/r/private')));
  await assertFails(getDocs(collection(member, 'meetings/new/rounds/r/responses')));
  await assertFails(getDoc(doc(member, 'meetings/new/rounds/r/published/a')));
  await assertSucceeds(getDoc(doc(host, 'meetings/new')));
  await assertFails(setDoc(doc(member, 'meetings/new/rounds/r/private/member'), { answers: {} }));
  await assertFails(updateDoc(doc(host, 'meetings/new'), { status: 'finished' }));
  await env.withSecurityRulesDisabled((context) =>
    updateDoc(doc(context.firestore(), 'meetings/new/rounds/r'), { visible: true }),
  );
  await assertSucceeds(getDoc(doc(member, 'meetings/new/rounds/r/published/a')));
  await assertFails(getDoc(doc(other, 'meetings/new/rounds/r/published/a')));
});
