import { pathToFileURL } from 'node:url';
import { openStore } from '../server/database.mjs';
import { businessDefaults } from '../shared/business.mjs';

export function seedBusiness(store) {
  const existing = store.get('settings', 'business');
  return store.saveSettings({ ...businessDefaults, ...existing, name: existing?.name?.trim() || 'Perfume by Aysha' });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const store = openStore();
    try { console.log(`Business profile ready: ${seedBusiness(store).name}`); }
    finally { store.close(); }
  } catch (error) { console.error('Business seed failed:', error.message); process.exitCode = 1; }
}
