import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../server/database.mjs';
import { seedAdmin } from './seed-admin.mjs';

const email = 'owner@example.com', password = 'a-strong-test-password';
test('seeding creates a local owner and preserves an existing password', t => {
  const store = openStore(':memory:'); t.after(() => store.close());
  assert.equal(seedAdmin(store, { email, password }).created, true);
  assert.equal(seedAdmin(store, { email, password: 'different-password' }).created, false);
  assert.equal(store.authenticate(email, password).email, email);
  assert.throws(() => seedAdmin(store, { email: 'other@example.com', password }), /different owner/);
});
test('explicit password recovery revokes old sessions', t => {
  const store = openStore(':memory:'); t.after(() => store.close());
  const user = seedAdmin(store, { email, password });
  const session = store.createSession(user.id);
  seedAdmin(store, { email, password: 'new-strong-password', resetPassword: true });
  assert.equal(store.sessionUser(session), null);
  assert.throws(() => store.authenticate(email, password), /Incorrect/);
  assert.equal(store.authenticate(email, 'new-strong-password').id, user.id);
});

test('local admin seeding accepts eight-character passwords', t => {
  const store = openStore(':memory:'); t.after(() => store.close());
  assert.throws(() => seedAdmin(store, { email, password: 'short' }), /between 8 and 1024/);
  const account = seedAdmin(store, { email, password: 'demo1234' });
  assert.equal(store.authenticate(email, 'demo1234').id, account.id);
  assert.throws(() => store.authenticate(email, 'incorrect'), /Incorrect/);
});
