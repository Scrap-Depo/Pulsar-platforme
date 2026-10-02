// Diagnostic control: the exact authenticated callable in one concurrent process.
// This does not emulate Cloud Run scheduling, cold starts, IAM or network latency.
import { http } from '@google-cloud/functions-framework';
import { getTestServer } from '@google-cloud/functions-framework/testing';

// Set before importing Admin SDK; this runner must never contact a real project.
process.env.GCLOUD_PROJECT = 'demo-pulsar';
process.env.GOOGLE_CLOUD_PROJECT = 'demo-pulsar';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-pulsar' });
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8185';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const { pulsar } = await import('../functions/index.mjs');
http('pulsar', pulsar);
const server = getTestServer('pulsar');
server.listen(5002, '127.0.0.1', () => {
  console.log('Local concurrent callable: http://127.0.0.1:5002 (demo-pulsar only)');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
