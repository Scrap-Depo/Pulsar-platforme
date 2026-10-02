let services;
let handler;
async function load() {
  if (handler) return handler;
  const [{ cert, getApps, initializeApp }, { getAuth }, { getFirestore }, { createService }, { createHttpHandler }] =
    await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/auth'),
      import('firebase-admin/firestore'),
      import('../functions/service.mjs'),
      import('../server/http-handler.mjs'),
    ]);
  handler = createHttpHandler(() => {
    if (services) return services;
    // This endpoint is for production credentials only. Emulator tests inject
    // their own services into createHttpHandler instead.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('Emulators must not be enabled in the deployed API.');
    }
    // Reasons are logged by the HTTP handler; they never include credential contents.
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set for this deployment.');
    }
    let credentials;
    try {
      credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    if (!credentials?.project_id || !credentials.private_key || !credentials.client_email) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON lacks project_id, private_key or client_email.');
    }
    if (credentials.project_id !== process.env.VITE_FIREBASE_PROJECT_ID) {
      throw new Error('VITE_FIREBASE_PROJECT_ID is missing or differs from the service account project.');
    }
    const app = getApps().find((app) => app.name === 'pulsar-server') || initializeApp({
      credential: cert(credentials),
      projectId: credentials.project_id,
    }, 'pulsar-server');
    services = { auth: getAuth(app), execute: createService(getFirestore(app)) };
    return services;
  });
  return handler;
}
// Modules load lazily so a missing dependency is reported as JSON with its cause
// instead of an opaque FUNCTION_INVOCATION_FAILED page.
export default async function pulsar(req, res) {
  let run;
  try {
    run = await load();
  } catch (error) {
    console.error('Pulsar API failed to load', error);
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({
      error: {
        message: `Сервер встреч не запустился: ${error?.code || error?.name || 'ошибка'} — ${String(error?.message || error).slice(0, 300)}`,
      },
    });
    return;
  }
  return run(req, res);
}
