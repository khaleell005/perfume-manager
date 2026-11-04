import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../server/database.mjs';
import { seedBusiness } from './seed-business.mjs';
test('business seeding adds Perfume by Aysha and preserves subsequent customization', t => {
  const store = openStore(':memory:'); t.after(() => store.close());
  const first = seedBusiness(store);
  assert.equal(first.name, 'Perfume by Aysha');
  assert.match(first.logo, /^data:image\/jpeg;base64,/);
  const customLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  store.saveSettings({ name: 'My renamed shop', phone: '08012345678', threshold: 9, logo: customLogo });
  const repeated = seedBusiness(store);
  assert.equal(repeated.name, 'My renamed shop'); assert.equal(repeated.phone, '08012345678'); assert.equal(repeated.threshold, 9); assert.equal(repeated.logo, customLogo);
});
