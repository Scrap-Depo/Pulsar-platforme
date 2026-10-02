import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createService } from '../functions/service.mjs';
import { createHttpHandler } from '../server/http-handler.mjs';

let services;
export default createHttpHandler(() => {
  if (services) return services;
  // This endpoint is for production credentials only. Emulator tests inject
  // their own services into createHttpHandler instead.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Emulators must not be enabled in the deployed API.');
  }
  const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 'null');
  if (!credentials?.project_id || credentials.project_id !== process.env.VITE_FIREBASE_PROJECT_ID) {
    throw new Error('Firebase server and browser must use the same project.');
  }
  const app = getApps().find((app) => app.name === 'pulsar-server') || initializeApp({
    credential: cert(credentials),
    projectId: credentials.project_id,
  }, 'pulsar-server');
  services = { auth: getAuth(app), execute: createService(getFirestore(app)) };
  return services;
});
