import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineInt, select } from 'firebase-functions/params';
import { createService } from './service.mjs';
initializeApp();
// Explicit per-project opt-in: idle instances incur charges after deployment.
// Keep local development and unconfigured projects at zero idle instances.
const minInstances = defineInt('PULSAR_MIN_INSTANCES', {
  default: 0,
  description: 'Готовые экземпляры: 0 — обычный режим; 1 — платная готовность к мероприятию.',
  input: select({ 'Обычный режим': 0, 'Один готовый экземпляр': 1 }),
});
const execute = createService(getFirestore(), (timing) => {
  // No identities, answer text or credentials in performance logs.
  console.info(JSON.stringify({ event: 'pulsar-submit-timing', ...timing, pid: process.pid }));
});
export const pulsar = onCall(
  {
    region: 'europe-west1',
    timeoutSeconds: 120,
    cpu: 1,
    memory: '512MiB',
    concurrency: 100,
    minInstances,
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Войдите в приложение.');
    try {
      return await execute(
        request.auth.uid,
        request.auth.token.firebase?.sign_in_provider,
        request.data,
      );
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('Pulsar action failed', request.data?.action, error.message);
      throw new HttpsError(
        'failed-precondition',
        error.message || 'Не удалось выполнить действие.',
      );
    }
  },
);
