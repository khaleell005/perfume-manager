import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { firebaseServices } from '../server/firebase-admin.mjs';
import { workspaceCollections } from '../server/workspace.mjs';

export async function verifyFirebase() {
  const { app, auth, db } = firebaseServices();
  const key = process.env.VITE_FIREBASE_API_KEY;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, returnSecureToken: true }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Admin sign-in failed: ${result.error?.message || response.status}`);
  const claims = await auth.verifyIdToken(result.idToken, true);
  if (claims.admin !== true) throw new Error('Admin custom claim is missing.');
  console.log('Firebase email/password login and verified admin claim: passed');
  const rules = await getSecurityRules(app).getFirestoreRuleset();
  const expected = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  if (!rules.source.some(file => file.content === expected)) throw new Error('Published Firestore rules differ from the local rules.');
  console.log('Published admin-only Firestore rules: verified');
  const url = `https://firestore.googleapis.com/v1/projects/${app.options.projectId}/databases/(default)/documents/products?pageSize=1`;
  const adminRead = await fetch(url, { headers: { Authorization: `Bearer ${result.idToken}` } });
  const anonymousRead = await fetch(url);
  if (adminRead.status !== 200 || anonymousRead.status !== 403) throw new Error(`Firestore access check failed (admin ${adminRead.status}, anonymous ${anonymousRead.status}).`);
  console.log('Firestore admin read allowed; anonymous read denied: passed');
  const counts = {};
  for (const name of workspaceCollections) counts[name] = (await db.collection(name).count().get()).data().count;
  const business = (await db.collection('settings').doc('business').get()).data();
  if (!business?.name || !/^data:image\/(png|jpeg|webp);base64,/.test(business.logo || '')) throw new Error('Cloud business name or logo is missing.');
  console.log(`Cloud business branding: ${business.name} with logo`);
  console.log('Cloud record counts (read-only):', JSON.stringify(counts));
  console.log('No test records or local seed data were written to Firestore.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) verifyFirebase().catch(error => { console.error(error.message); process.exitCode = 1; });
