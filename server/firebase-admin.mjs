import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

let services;
export function firebaseServices() {
  if (services) return services;
  let app = getApps().find(app => app.name === 'perfume-server');
  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID in the root .env file.');
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credential = path ? cert(JSON.parse(readFileSync(path, 'utf8'))) : applicationDefault();
    app = initializeApp({ projectId, credential }, 'perfume-server');
  }
  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  services = { app, auth: getAuth(app), db };
  return services;
}
