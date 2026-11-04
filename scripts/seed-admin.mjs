import { pathToFileURL } from 'node:url';
import { openStore } from '../server/database.mjs';

export function seedAdmin(store, { email, password, resetPassword = false }) {
  if (!email) throw new Error('Set ADMIN_EMAIL in .env before seeding.');
  email = email.trim().toLowerCase();
  const existing = store.findOwner(email);
  if (existing) {
    if (resetPassword) store.resetOwnerPassword(email, password);
    return { ...existing, created: false, passwordReset: resetPassword };
  }
  if (store.hasOwner()) throw new Error('This workspace already has a different owner.');
  return { ...store.createOwner({ email, password }), created: true, passwordReset: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const store = openStore();
    try {
      const account = seedAdmin(store, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, resetPassword: process.argv.includes('--reset-password') });
      console.log(`${account.created ? 'Created' : 'Found existing'} SQLite owner account: ${account.email}`);
      if (account.passwordReset) console.log('Password reset. Existing sessions have been signed out.');
      console.log('Remove ADMIN_PASSWORD from .env when finished.');
    } finally { store.close(); }
  } catch (error) {
    console.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  }
}
