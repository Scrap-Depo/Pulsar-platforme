import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp } from '../functions/node_modules/firebase-admin/lib/esm/app/index.js';
import { getFirestore } from '../functions/node_modules/firebase-admin/lib/esm/firestore/index.js';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { createService } from '../functions/service.mjs';
import { responseId } from '../functions/domain.mjs';
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Only run against Firestore emulator.');
const projectId = 'demo-pulsar';
const db = getFirestore(initializeApp({ projectId }, 'integration'));
const execute = createService(db);
const call = (uid, action, extra = {}) =>
  execute(uid, uid.startsWith('host') ? 'password' : 'anonymous', { action, ...extra });
let env;
const runId = Date.now().toString(36);
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8185, rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => {
  await env?.cleanup();
  await db.terminate();
});
const slides = [
  {
    id: 'choice',
    type: 'multiple-choice',
    title: 'Выбор',
    options: [
      { id: 1, text: 'A' },
      { id: 2, text: 'B' },
    ],
    visualization: 'bar',
    resultDisplay: 'both',
  },
  { id: 'text', type: 'open-answers', title: 'Мнение', visualization: 'cards', allowLikes: false },
  {
    id: 'pulse',
    type: 'pulse',
    title: 'Оценка',
    minLabel: 'Мало',
    maxLabel: 'Много',
    visualization: 'bars',
    projectorView: 'histogram',
    metricDisplay: 'average',
  },
  { id: 'cloud', type: 'word-cloud', title: 'Ассоциация', useAI: true, visualization: 'cloud' },
];
async function meeting(id) {
  return call('host-a', 'create', { requestId: `${id}-${runId}`, title: 'Проверка', slides });
}
const send = (uid, sid, rid, value, extra = {}) =>
  call(uid, 'submit', {
    sessionId: sid,
    roundId: rid,
    value,
    slot: 0,
    revision: 0,
    requestId: `${uid}-${rid}`,
    ...extra,
  });

test('isolation, auth, private collection, idempotent submission and closed gate', async () => {
  const { id: sid, joinCode } = await meeting('test-access');
  assert.equal((await meeting('test-access')).id, sid);
  await assert.rejects(call('person', 'create', { requestId: 'illegal', slides }));
  await assert.rejects(
    call('host-b', 'save', { sessionId: sid, slides, title: 'Hack', version: 1 }),
  );
  await call('a', 'join', { code: joinCode });
  await call('b', 'join', { code: joinCode });
  await call('viewer', 'join', { code: joinCode, viewer: true });
  await call('a', 'join', { code: joinCode });
  assert.equal((await db.collection(`meetings/${sid}/members`).get()).size, 2);
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'choice',
    requestId: 'r1',
    settings: { moderation: true, immediate: false },
  });
  await Promise.all([send('a', sid, 'r1', 1), send('a', sid, 'r1', 1)]);
  await assert.rejects(send('a', sid, 'r1', 2)); // A reused request ID cannot acknowledge different content.
  await send('b', sid, 'r1', 2);
  assert.equal((await db.collection(`meetings/${sid}/rounds/r1/responses`).get()).size, 2);
  const user = env.authenticatedContext('a').firestore();
  const outsider = env.authenticatedContext('outsider').firestore();
  const path = `meetings/${sid}/rounds/r1`;
  await assertSucceeds(
    getDocs(query(collection(user, `${path}/responses`), where('participantId', '==', 'a'))),
  );
  await assertFails(getDocs(collection(user, `${path}/responses`)));
  await assertFails(getDoc(doc(user, `${path}/responses/${responseId('r1', 'b', 0)}`)));
  await assertFails(getDocs(collection(user, `${path}/published`)));
  await assertFails(getDoc(doc(outsider, `rooms/${sid}`)));
  await assertFails(setDoc(doc(user, `rooms/${sid}`), { status: 'live' }));
  await assertFails(setDoc(doc(user, `${path}/responses/spoof`), { value: 1 }));
  await assert.rejects(send('viewer', sid, 'r1', 1));
  await call('host-a', 'close', { sessionId: sid });
  await send('a', sid, 'r1', 1); // Acknowledgement lost before closing: retry confirms existing record.
  await assert.rejects(send('a', sid, 'r1', 2, { revision: 1, requestId: 'late' }));
  await call('host-a', 'reveal', { sessionId: sid });
  const visible = await assertSucceeds(getDocs(collection(user, `${path}/published`)));
  assert.equal(visible.size, 2);
  assert.equal('participantId' in visible.docs[0].data(), false);
  await assertFails(getDoc(doc(outsider, `${path}/published/${visible.docs[0].id}`)));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('viewer').firestore(), `rooms/${sid}`)));
});

test('moderation, revision conflicts, freeze, likes and historical rounds', async () => {
  const { id: sid, joinCode } = await meeting('test-moderation');
  await call('a', 'join', { code: joinCode });
  await call('b', 'join', { code: joinCode });
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'text',
    requestId: 'text1',
    settings: { moderation: true, immediate: true, cardLimit: 3 },
  });
  const sent = await send('a', sid, 'text1', 'Оригинал');
  await assert.rejects(send('a', sid, 'text1', 'Четвёртая', { slot: 3 }));
  assert.equal((await db.collection(`meetings/${sid}/rounds/text1/published`).get()).size, 0);
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: [sent.id],
    revisions: { [sent.id]: 1 },
    status: 'approved',
    displayValue: 'Редакция',
    revision: 1,
  });
  const raw = (await db.doc(`meetings/${sid}/rounds/text1/responses/${sent.id}`).get()).data();
  assert.equal(raw.value, 'Оригинал');
  assert.equal(raw.displayValue, 'Редакция');
  await call('host-a', 'freeze', { sessionId: sid, enabled: true });
  await send('b', sid, 'text1', 'Второй');
  assert.equal((await db.doc(`rooms/${sid}`).get()).data().frozen.results.length, 1);
  await send('a', sid, 'text1', 'Изменение', { revision: 1, requestId: 'edit' });
  assert.equal((await db.collection(`meetings/${sid}/rounds/text1/published`).get()).size, 0);
  await assert.rejects(
    send('a', sid, 'text1', 'Старая вкладка', { revision: 1, requestId: 'stale' }),
  );
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: [sent.id],
    revisions: { [sent.id]: 2 },
    status: 'approved',
  });
  await call('host-a', 'close', { sessionId: sid });
  await call('host-a', 'likes', { sessionId: sid, enabled: true });
  await Promise.all([
    call('b', 'like', { sessionId: sid, responseId: sent.id, enabled: true }),
    call('b', 'like', { sessionId: sid, responseId: sent.id, enabled: true }),
  ]);
  assert.equal(
    (await db.doc(`meetings/${sid}/rounds/text1/published/${sent.id}`).get()).data().likes,
    1,
  );
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: [sent.id],
    revisions: { [sent.id]: 2 },
    status: 'hidden',
  });
  assert.equal((await db.doc(`rooms/${sid}`).get()).data().frozen, null);
  await assert.rejects(call('b', 'like', { sessionId: sid, responseId: sent.id, enabled: true }));
  await call('host-a', 'open', { sessionId: sid, slideId: 'text', requestId: 'text2' });
  assert.equal((await db.collection(`meetings/${sid}/rounds/text2/responses`).get()).size, 0);
  assert.equal((await db.collection(`meetings/${sid}/rounds/text1/responses`).get()).size, 2);
});

test('finish, export and recursive deletion remove all descendants and access', async () => {
  const { id: sid, joinCode } = await meeting('test-delete');
  await call('a', 'join', { code: joinCode });
  await call('host-a', 'open', { sessionId: sid, slideId: 'cloud', requestId: 'cloud1' });
  await send('a', sid, 'cloud1', 'Слово');
  await call('host-a', 'finish', { sessionId: sid });
  await assert.rejects(send('a', sid, 'cloud1', 'Поздно', { revision: 1, requestId: 'late' }));
  const exported = await call('host-a', 'export', { sessionId: sid });
  assert.equal(exported.rounds[0].answeredCount, 1);
  assert.equal('participantId' in exported.rounds[0].responses[0], false);
  await assert.rejects(call('host-b', 'delete', { sessionId: sid }));
  await call('host-a', 'delete', { sessionId: sid });
  assert.equal((await db.doc(`rooms/${sid}`).get()).exists, false);
  assert.equal((await db.collection(`meetings/${sid}/rounds/cloud1/responses`).get()).size, 0);
  await assert.rejects(call('a', 'join', { code: joinCode }));
});

test('100 members, all types, simultaneous submissions and authoritative counts', async () => {
  const { id: sid, joinCode } = await meeting('test-load');
  // Admission is intentionally spread; answer delivery is a simultaneous burst.
  for (let i = 0; i < 100; i++) await call(`load-${i}`, 'join', { code: joinCode });
  await assert.rejects(call('overflow', 'join', { code: joinCode }));
  const measurements = [];
  for (const slide of slides) {
    const rid = `load-${slide.id}`;
    await call('host-a', 'open', { sessionId: sid, slideId: slide.id, requestId: rid });
    const times = [];
    const begin = performance.now();
    await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        const start = performance.now();
        const answer =
          slide.type === 'multiple-choice'
            ? (i % 2) + 1
            : slide.type === 'pulse'
              ? (i % 10) + 1
              : `Ответ ${i}`;
        await send(`load-${i}`, sid, rid, answer);
        times.push(performance.now() - start);
      }),
    );
    const elapsed = performance.now() - begin;
    const saved = await db.collection(`meetings/${sid}/rounds/${rid}/responses`).get();
    assert.equal(saved.size, 100);
    assert.equal(new Set(saved.docs.map((d) => d.data().participantId)).size, 100);
    if (['open-answers', 'word-cloud'].includes(slide.type))
      await call('host-a', 'moderate', {
        sessionId: sid,
        ids: saved.docs.map((d) => d.id),
        revisions: Object.fromEntries(saved.docs.map((d) => [d.id, d.data().revision])),
        status: 'approved',
      });
    await call('host-a', 'close', { sessionId: sid });
    await call('host-a', 'reveal', { sessionId: sid });
    assert.equal((await db.collection(`meetings/${sid}/rounds/${rid}/published`).get()).size, 100);
    times.sort((a, b) => a - b);
    measurements.push({
      type: slide.type,
      answers: saved.size,
      elapsedMs: Math.round(elapsed),
      p95Ms: Math.round(times[94]),
    });
  }
  console.log(
    'Emulator service timings (NOT production network/browser latency):',
    JSON.stringify(measurements),
  );
  writeFileSync('/private/tmp/pulsar-load-results.json', JSON.stringify(measurements, null, 2));
});

test('closing races with delivery: every acknowledged response is stored, late writes fail', async () => {
  const { id: sid, joinCode } = await meeting('test-race');
  for (let i = 0; i < 20; i++) await call(`race-${i}`, 'join', { code: joinCode });
  await call('host-a', 'open', { sessionId: sid, slideId: 'choice', requestId: 'race-round' });
  const sends = Array.from({ length: 20 }, (_, i) => send(`race-${i}`, sid, 'race-round', 1));
  const closing = call('host-a', 'close', { sessionId: sid });
  const results = await Promise.allSettled(sends);
  await closing;
  const stored = await db.collection(`meetings/${sid}/rounds/race-round/responses`).get();
  assert.equal(stored.size, results.filter((r) => r.status === 'fulfilled').length);
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') await send(`race-${i}`, sid, 'race-round', 1);
    await assert.rejects(
      send(`race-${i}`, sid, 'race-round', 2, { revision: 1, requestId: `late-${i}` }),
    );
  }
});

test('private receipt isolates participants and atomically preserves cards, edits and moderation', async () => {
  const { id: sid, joinCode } = await meeting('test-receipt');
  await call('a', 'join', { code: joinCode });
  await call('b', 'join', { code: joinCode });
  await call('viewer', 'join', { code: joinCode, viewer: true });
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'text',
    requestId: 'receipt-round',
    settings: { moderation: true, cardLimit: 3 },
  });
  const path = `meetings/${sid}/rounds/receipt-round/private/a`;
  const user = env.authenticatedContext('a').firestore();
  assert.equal((await assertSucceeds(getDoc(doc(user, path)))).exists(), false);
  for (const other of ['b', 'viewer', 'outsider'])
    await assertFails(getDoc(doc(env.authenticatedContext(other).firestore(), path)));
  await assertFails(setDoc(doc(user, path), { answers: {} }));
  await assertFails(getDocs(collection(user, `meetings/${sid}/rounds/receipt-round/private`)));
  const sent = await Promise.all(
    [0, 1, 2].map((slot) =>
      send('a', sid, 'receipt-round', `Текст ${slot}`, { slot, requestId: `slot-${slot}` }),
    ),
  );
  const read = async () => (await assertSucceeds(getDoc(doc(user, path)))).data().answers;
  assert.equal(Object.keys(await read()).length, 3);
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: sent.map((s) => s.id),
    revisions: Object.fromEntries(sent.map((s) => [s.id, 1])),
    status: 'approved',
  });
  assert.ok(Object.values(await read()).every((r) => r.moderation === 'approved'));
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: [sent[1].id],
    revisions: { [sent[1].id]: 1 },
    revision: 1,
    status: 'approved',
    displayValue: 'Редакция',
  });
  assert.equal((await read())[1].displayValue, 'Редакция');
  await send('a', sid, 'receipt-round', 'Обновление', {
    slot: 1,
    revision: 1,
    requestId: 'update',
  });
  const updated = await read();
  assert.equal(updated[1].value, 'Обновление');
  assert.equal(updated[1].displayValue, null);
  assert.equal(updated[1].moderation, 'pending');
  assert.equal(updated[1].revision, 2);
  assert.equal(updated[0].value, 'Текст 0');
  assert.equal(updated[2].value, 'Текст 2');
  assert.equal('history' in updated[1], false);
  // Existing local rounds acquire the new receipt on re-entry.
  await db.doc(path).delete();
  await call('a', 'join', { code: joinCode });
  assert.deepEqual(await read(), updated);
  await call('host-a', 'close', { sessionId: sid });
  await send('a', sid, 'receipt-round', 'Обновление', {
    slot: 1,
    revision: 1,
    requestId: 'update',
  });
  await assert.rejects(
    send('a', sid, 'receipt-round', 'Поздний', { slot: 1, revision: 2, requestId: 'late' }),
  );
  assert.deepEqual(await read(), updated);
  await call('host-a', 'delete', { sessionId: sid });
  assert.equal((await db.doc(path).get()).exists, false);
});

test('draft launch gates, persisted settings, immutable old rounds and selected closed export', async () => {
  const initial = [
    {
      ...slides[0],
      title: '',
      options: [
        { id: 1, text: '' },
        { id: 2, text: '' },
      ],
      launch: { cardLimit: 3, moderation: true, immediate: false },
    },
  ];
  const { id: sid, joinCode } = await call('host-a', 'create', {
    requestId: `test-launch-${runId}`,
    title: 'Черновик',
    slides: initial,
  });
  await assert.rejects(
    call('host-a', 'open', { sessionId: sid, slideId: 'choice', requestId: 'blank' }),
    /текст вопроса/,
  );
  await call('host-a', 'save', {
    sessionId: sid,
    version: 1,
    title: 'Черновик',
    currentSlideId: 'choice',
    slides: [{ ...initial[0], title: 'Выбор' }],
  });
  await assert.rejects(
    call('host-a', 'open', { sessionId: sid, slideId: 'choice', requestId: 'blank-options' }),
    /все варианты/,
  );
  await call('host-a', 'save', {
    sessionId: sid,
    version: 2,
    title: 'Черновик',
    currentSlideId: 'choice',
    slides: [
      {
        ...initial[0],
        title: 'Выбор',
        options: [
          { id: 1, text: ' Новый  продукт ' },
          { id: 2, text: 'новый продукт' },
        ],
      },
    ],
  });
  await assert.rejects(
    call('host-a', 'open', { sessionId: sid, slideId: 'choice', requestId: 'duplicate' }),
    /отличаться/,
  );
  const complete = { ...slides[0], launch: { cardLimit: 3, moderation: true, immediate: false } };
  await call('host-a', 'save', {
    sessionId: sid,
    version: 3,
    title: 'Черновик',
    currentSlideId: 'choice',
    slides: [complete],
  });
  await call('host-a', 'join', { code: joinCode });
  await call('person-export', 'join', { code: joinCode });
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'choice',
    requestId: 'saved',
    settings: { moderation: true, cardLimit: 3, moderation: true, immediate: true },
  });
  const roundRef = db.doc(`meetings/${sid}/rounds/saved`);
  const before = (await roundRef.get()).data();
  assert.deepEqual(before.settings, {
    cardLimit: 1,
    moderation: false,
    immediate: false,
    showOnPhones: false,
  });
  await assert.rejects(
    call('host-a', 'export', { sessionId: sid, roundId: 'saved' }),
    /Завершите сбор/,
  );
  await send('person-export', sid, 'saved', 1);
  await call('host-a', 'save', {
    sessionId: sid,
    version: 4,
    title: 'Черновик',
    currentSlideId: 'choice',
    slides: [
      {
        ...complete,
        title: 'Изменённый вопрос',
        launch: { cardLimit: 1, moderation: false, immediate: true },
      },
    ],
  });
  assert.deepEqual((await roundRef.get()).data(), before);
  await call('host-a', 'close', { sessionId: sid });
  await call('host-a', 'open', { sessionId: sid, slideId: 'choice', requestId: 'next' });
  await assert.rejects(
    call('host-b', 'export', { sessionId: sid, roundId: 'saved' }),
    /Нет доступа/,
  );
  await assert.rejects(call('host-a', 'export', { sessionId: sid }), /Завершите встречу/);
  const exported = await call('host-a', 'export', { sessionId: sid, roundId: 'saved' });
  assert.equal(exported.rounds.length, 1);
  assert.equal(exported.rounds[0].id, 'saved');
  assert.equal(exported.rounds[0].slide.title, 'Выбор');
  assert.equal(exported.rounds[0].answeredCount, 1);
  assert.equal('participantId' in exported.rounds[0].responses[0], false);
  assert.equal('requestId' in exported.rounds[0].responses[0], false);
  assert.equal((await db.doc(`meetings/${sid}/rounds/next`).get()).data().visible, true);
});

test('preview exposes only meeting title, does not join, and old 10-character codes still work', async () => {
  const { id: sid, joinCode } = await meeting('test-preview');
  const preview = await call('preview-person', 'previewMeeting', { code: joinCode });
  assert.deepEqual(preview, { title: 'Проверка', code: joinCode });
  assert.equal((await db.collection(`meetings/${sid}/members`).get()).size, 0);
  const legacyCode = '1899AD11B7';
  await db.doc(`joinCodes/${legacyCode}`).set({ sessionId: sid });
  await db.doc(`meetings/${sid}`).update({ joinCode: legacyCode });
  assert.equal(
    (await call('preview-person', 'previewMeeting', { code: '1899 AD11B7' })).title,
    'Проверка',
  );
  await call('preview-person', 'join', { code: legacyCode });
  assert.equal((await db.collection(`meetings/${sid}/members`).get()).size, 1);
  await call('host-a', 'finish', { sessionId: sid });
  await assert.rejects(call('preview-person', 'previewMeeting', { code: legacyCode }), /завершена/);
});

test('reveal and likes during collection, revisions reset likes, finish closes current collection', async () => {
  const { id: sid, joinCode } = await meeting('test-live-controls');
  await call('a', 'join', { code: joinCode });
  await call('b', 'join', { code: joinCode });
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'text',
    requestId: 'live-controls',
    settings: { moderation: true, immediate: false },
  });
  await send('a', sid, 'live-controls', 'Первый');
  const ref = db.doc(`meetings/${sid}/rounds/live-controls`);
  const response = responseId('live-controls', 'a', 0);
  await call('host-a', 'moderate', {
    sessionId: sid,
    ids: [response],
    revisions: { [response]: 1 },
    status: 'approved',
  });
  await call('host-a', 'reveal', { sessionId: sid });
  await call('host-a', 'likes', { sessionId: sid, enabled: true });
  assert.equal((await ref.get()).data().phase, 'open');
  await call('b', 'like', { sessionId: sid, responseId: response, enabled: true });
  assert.equal((await ref.collection('responses').doc(response).get()).data().likes, 1);
  await call('a', 'submit', {
    sessionId: sid,
    roundId: 'live-controls',
    slot: 0,
    value: 'Правка',
    revision: 1,
    requestId: 'changed-live',
  });
  assert.equal((await ref.collection('responses').doc(response).get()).data().likes, 0);
  await assert.rejects(
    call('b', 'like', { sessionId: sid, responseId: response, enabled: true }),
    /скрыта/,
  );
  await call('host-a', 'open', {
    sessionId: sid,
    slideId: 'cloud',
    requestId: 'next-live-controls',
  });
  assert.equal((await ref.get()).data().phase, 'closed');
  assert.equal((await ref.get()).data().likesOpen, false);
  await assert.rejects(send('b', sid, 'live-controls', 'Поздно'));
  await call('host-a', 'finish', { sessionId: sid });
  const closed = (await db.doc(`meetings/${sid}/rounds/next-live-controls`).get()).data();
  assert.equal(closed.phase, 'closed');
  assert.equal(closed.likesOpen, false);
  await assert.rejects(send('b', sid, 'live-controls', 'Поздно'));
});
