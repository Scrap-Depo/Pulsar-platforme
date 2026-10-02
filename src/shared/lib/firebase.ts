import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
const emulated = import.meta.env.VITE_USE_EMULATORS === 'true';
const firebaseConfig = {
  apiKey: emulated ? 'demo-key' : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: emulated ? 'demo-pulsar.firebaseapp.com' : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: emulated ? 'demo-pulsar' : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: emulated ? 'demo-app' : import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configurationError =
  !firebaseConfig.apiKey || !firebaseConfig.projectId
    ? 'Не настроено подключение. Заполните VITE_FIREBASE_* в .env.local.'
    : '';
export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(
      configurationError
        ? { apiKey: 'missing-config', projectId: 'not-configured', appId: 'missing' }
        : firebaseConfig,
    );
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const api = getFunctions(firebaseApp, 'europe-west1');
if (
  emulated &&
  !(globalThis as typeof globalThis & { pulsarEmulators?: boolean }).pulsarEmulators
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8185);
  connectFunctionsEmulator(api, '127.0.0.1', 5001);
  (globalThis as typeof globalThis & { pulsarEmulators?: boolean }).pulsarEmulators = true;
}
