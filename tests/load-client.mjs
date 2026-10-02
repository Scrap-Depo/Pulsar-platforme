// 100 independent authenticated SDK clients against local emulators only.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  terminate,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
const runId = Date.now();
const immediate = process.env.PULSAR_LOAD_MODE !== 'hidden';
const functionPort = Number(process.env.PULSAR_FUNCTION_PORT || 5001);
assert.ok([5001, 5002].includes(functionPort), 'Only local test endpoints are allowed.');
const repeats = Number(process.env.PULSAR_LOAD_REPEATS || 1);
assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 3);
const observerCount = Number(process.env.PULSAR_LOAD_OBSERVERS || 100);
assert.ok(Number.isInteger(observerCount) && observerCount >= 1 && observerCount <= 100);
const privateListeners = process.env.PULSAR_LOAD_PRIVATE_LISTENERS !== 'false';
const privateMode = process.env.PULSAR_LOAD_PRIVATE_MODE || 'document';
assert.ok(['query', 'document'].includes(privateMode));
const apps = [],
  unsubscribers = [];
const roomUnsubscribers = [];
function client(id) {
  const app = initializeApp(
    { apiKey: 'demo-key', projectId: 'demo-pulsar', appId: 'demo-app' },
    `${runId}-${id}`,
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8185);
  const api = getFunctions(app, 'europe-west1');
  connectFunctionsEmulator(api, '127.0.0.1', functionPort);
  const invoke = httpsCallable(api, 'pulsar', { timeout: 60000 });
  return { auth, db, call: async (action, data = {}) => (await invoke({ action, ...data })).data };
}
function listen(ref, predicate, stops = unsubscribers) {
  let lastSnapshot = 'none';
  let resolve, reject, readyResolve, readyReject;
  const ready = new Promise((res, rej) => {
    readyResolve = res;
    readyReject = rej;
  });
  const result = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Attach rejection handlers immediately while other clients are still connecting.
  ready.catch(() => {});
  result.catch(() => {});
  const timer = setTimeout(() => {
    const error = new Error(
      `Snapshot deadline exceeded: ${ref.path || ref._query?.path?.canonicalString()} (${lastSnapshot})`,
    );
    readyReject(error);
    reject(error);
  }, 120000);
  const stop = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      lastSnapshot = JSON.stringify({
        size: snap.size,
        answers: snap.data ? Object.keys(snap.data()?.answers ?? {}).length : undefined,
        fromCache: snap.metadata.fromCache,
      });
      if (snap.metadata.fromCache) return;
      readyResolve();
      if (predicate(snap)) {
        clearTimeout(timer);
        resolve(performance.now());
      }
    },
    (e) => {
      clearTimeout(timer);
      readyReject(e);
      reject(e);
    },
  );
  stops.push(() => {
    clearTimeout(timer);
    stop();
  });
  return { ready, result };
}
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
try {
  const host = client('host');
  await createUserWithEmailAndPassword(
    host.auth,
    `load-${runId}@example.test`,
    'load-test-password',
  );
  const meeting = await host.call('create', {
    requestId: `sdk-load-${runId}`,
    title: 'SDK нагрузка',
    slides,
  });
  const users = [];
  for (let i = 0; i < 100; i++) {
    const user = client(i);
    await signInAnonymously(user.auth);
    await user.call('join', { code: meeting.joinCode });
    users.push(user);
    await listen(doc(user.db, `rooms/${meeting.id}`), (snap) => snap.exists(), roomUnsubscribers)
      .ready;
  }
  console.log('100 authenticated clients subscribed to the meeting.');
  const measurements = [];
  for (let iteration = 1; iteration <= repeats; iteration++)
    for (const slide of slides.filter(
      (s) => !process.env.PULSAR_LOAD_TYPE || s.type === process.env.PULSAR_LOAD_TYPE,
    )) {
      const roundId = `${slide.id}-${runId}-${iteration}`;
      await host.call('open', {
        sessionId: meeting.id,
        slideId: slide.id,
        requestId: roundId,
        settings: { immediate, moderation: false },
      });
      const publicPath = `meetings/${meeting.id}/rounds/${roundId}/published`;
      let deliveries = immediate
        ? users
            .slice(0, observerCount)
            .map((user) => listen(collection(user.db, publicPath), (snap) => snap.size === 100))
        : [];
      const privateConfirmations = (privateListeners ? users : []).map((user) =>
        listen(
          privateMode === 'document'
            ? doc(
                user.db,
                `meetings/${meeting.id}/rounds/${roundId}/private/${user.auth.currentUser.uid}`,
              )
            : query(
                collection(user.db, `meetings/${meeting.id}/rounds/${roundId}/responses`),
                where('participantId', '==', user.auth.currentUser.uid),
              ),
          (snap) =>
            privateMode === 'document'
              ? Object.keys(snap.data()?.answers ?? {}).length === 1
              : snap.size === 1,
        ),
      );
      // Include the host's real moderation/results subscription in the workload.
      const hostAnswers = listen(
        collection(host.db, `meetings/${meeting.id}/rounds/${roundId}/responses`),
        (snap) => snap.size === 100,
      );
      await Promise.all(
        [...deliveries, ...privateConfirmations, hostAnswers].map((listener) => listener.ready),
      );
      const start = performance.now();
      const latencies = await Promise.all(
        users.map(async (user, i) => {
          const value =
            slide.type === 'multiple-choice'
              ? (i % 2) + 1
              : slide.type === 'pulse'
                ? (i % 10) + 1
                : `Ответ ${i}`;
          const at = performance.now();
          await user.call('submit', {
            sessionId: meeting.id,
            roundId,
            slot: 0,
            revision: 0,
            requestId: `${roundId}-${i}`,
            value,
          });
          return performance.now() - at;
        }),
      );
      const ownSeenAt = await Promise.all(privateConfirmations.map((listener) => listener.result));
      await hostAnswers.result;
      let displayStart = start;
      if (!immediate) {
        await host.call('close', { sessionId: meeting.id });
        displayStart = performance.now();
        await host.call('reveal', { sessionId: meeting.id });
        deliveries = users
          .slice(0, observerCount)
          .map((user) => listen(collection(user.db, publicPath), (snap) => snap.size === 100));
      }
      const seenAt = await Promise.all(deliveries.map((listener) => listener.result));
      latencies.sort((a, b) => a - b);
      seenAt.sort((a, b) => a - b);
      measurements.push({
        type: slide.type,
        iteration,
        mode: immediate ? 'live' : 'hidden',
        clients: 100,
        publicObservers: observerCount,
        privateListeners,
        privateMode,
        p95ConfirmationMs: Math.round(latencies[94]),
        p95OwnSnapshotMs: privateListeners
          ? Math.round(ownSeenAt.sort((a, b) => a - b)[94] - start)
          : null,
        allResultsSeenBy95PercentMs: Math.round(
          seenAt[Math.ceil(observerCount * 0.95) - 1] - displayStart,
        ),
        allResultsSeenByAllMs: Math.round(seenAt.at(-1) - displayStart),
        confirmed: latencies.length,
        withinLocalBudget:
          latencies[94] <= 2000 &&
          seenAt[Math.ceil(observerCount * 0.95) - 1] - displayStart <= 3000,
      });
      console.log(JSON.stringify(measurements.at(-1)));
      // Stop old round listeners, keeping memory bounded between rounds.
      while (unsubscribers.length) unsubscribers.pop()();
      await host.call('close', { sessionId: meeting.id });
    }
  assert.equal(measurements.length, (process.env.PULSAR_LOAD_TYPE ? 1 : 4) * repeats);
  writeFileSync(
    process.env.PULSAR_LOAD_OUTPUT ||
      `/private/tmp/pulsar-sdk-${immediate ? 'live' : 'hidden'}-load-results.json`,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        functionPort,
        runner: functionPort === 5001 ? 'functions-emulator' : 'single-process-framework',
        clients: 100,
        roomListenersKept: true,
        hostAnswersListener: true,
        measurements,
      },
      null,
      2,
    ),
  );
  while (roomUnsubscribers.length) roomUnsubscribers.pop()();
  await host.call('finish', { sessionId: meeting.id });
  await host.call('delete', { sessionId: meeting.id });
  if (process.env.PULSAR_LOAD_ASSERT_BUDGET === 'true')
    assert.ok(
      measurements.every((m) => m.withinLocalBudget),
      'Local latency budget exceeded; see the saved report.',
    );
} finally {
  unsubscribers.forEach((stop) => stop());
  roomUnsubscribers.forEach((stop) => stop());
  await Promise.all(
    apps.map(async (app) => {
      await terminate(getFirestore(app));
      await deleteApp(app);
    }),
  );
}
