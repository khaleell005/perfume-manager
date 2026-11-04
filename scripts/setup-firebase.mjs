import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getSecurityRules } from 'firebase-admin/security-rules';
import { firebaseServices } from '../server/firebase-admin.mjs';

export async function setupFirebase() {
  const { app, auth } = firebaseServices();
  const project = app.options.projectId;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters in the root .env file.');
  const { access_token: accessToken } = await app.options.credential.getAccessToken();
  const api = async (url, method = 'GET', data) => {
    const response = await fetch(url, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error?.message || `Firebase setup failed (${response.status}).`); error.status = response.status; throw error; }
    return result;
  };
  const failures = [];
  const step = async (name, action) => {
    try { await action(); console.log(`${name}: ready`); }
    catch (error) { failures.push(name); console.error(`${name}: ${error.message}`); }
  };
  await step('Email/password authentication', () => api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config?updateMask=signIn.email`, 'PATCH', { signIn: { email: { enabled: true, passwordRequired: true } } }));
  await step('Admin account', async () => {
    let user;
    try { user = await auth.getUserByEmail(email); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    if (!user) user = await auth.createUser({ email, password, displayName: 'Business admin' });
    else if (process.argv.includes('--reset-password')) await auth.updateUser(user.uid, { password });
    await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
    console.log(`Admin access assigned to ${email}.`);
  });
  await step('Firestore database', async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases`;
    try { await api(`${url}/(default)`); }
    catch (error) {
      if (error.status !== 404) throw error;
      const operation = await api(`${url}?databaseId=(default)`, 'POST', { locationId: process.env.FIRESTORE_LOCATION || 'eur3', type: 'FIRESTORE_NATIVE' });
      let current = operation;
      for (let attempt = 0; !current.done && attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        current = await api(`https://firestore.googleapis.com/v1/${operation.name}`);
      }
      if (current.error) throw new Error(current.error.message);
      if (!current.done) throw new Error('Database creation is still running. Rerun setup shortly.');
    }
  });
  await step('Admin-only Firestore rules', () => getSecurityRules(app).releaseFirestoreRulesetFromSource(readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')));
  if (failures.length) throw new Error(`Complete these project setup steps and rerun: ${failures.join(', ')}.`);
  console.log('Firebase setup complete. No local records or demo data were uploaded.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupFirebase().catch(error => { console.error(error.message); process.exitCode = 1; });
}
