import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createService } from './service.mjs';
initializeApp();
const execute = createService(getFirestore(), (timing) => {
  // No identities, answer text or credentials in performance logs.
  console.info(JSON.stringify({ event: 'pulsar-submit-timing', ...timing, pid: process.pid }));
});
export const pulsar = onCall(
  { region: 'europe-west1', timeoutSeconds: 120, maxInstances: 10 },
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
