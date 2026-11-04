import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createFirestoreStore } from '../server/firestore-store.mjs';

export async function seedFirebaseBrand(store = createFirestoreStore()) {
  const logoPath = new URL('../logo.jpg', import.meta.url);
  if (!existsSync(logoPath)) throw new Error('The root logo.jpg file is missing.');
  const current = await store.get('settings', 'business');
  const logo = `data:image/jpeg;base64,${readFileSync(logoPath).toString('base64')}`;
  if (current?.name && current?.logo) return { profile: current, changed: false };
  const profile = await store.saveSettings({ ...current, name: current?.name || 'Perfume by Aysha', logo: current?.logo || logo });
  return { profile, changed: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedFirebaseBrand().then(({ profile, changed }) => {
    console.log(`${changed ? 'Saved' : 'Kept'} Firebase business branding: ${profile.name} with logo.`);
    console.log('No demo products, sales, customers, expenses, or refunds were uploaded.');
  }).catch(error => { console.error('Firebase branding failed:', error.message); process.exitCode = 1; });
}
