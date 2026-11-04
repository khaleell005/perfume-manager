import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { openStore } from '../server/database.mjs';
import { businessDefaults } from '../shared/business.mjs';

export function seedBusiness(store) {
  const existing = store.get('settings', 'business');
  const logoPath = new URL('../logo.jpg', import.meta.url);
  const demoLogo = existsSync(logoPath) ? `data:image/jpeg;base64,${readFileSync(logoPath).toString('base64')}` : '';
  return store.saveSettings({ ...businessDefaults, ...existing, name: existing?.name?.trim() || 'Perfume by Aysha', logo: existing?.logo || demoLogo });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const store = openStore();
    try { console.log(`Business profile ready: ${seedBusiness(store).name}`); }
    finally { store.close(); }
  } catch (error) { console.error('Business seed failed:', error.message); process.exitCode = 1; }
}
