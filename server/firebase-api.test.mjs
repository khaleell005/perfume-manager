import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApi } from './firebase-api.mjs';
import { createFirestoreStore } from './firestore-store.mjs';
import { fakeFirestore } from './testing/memory-store.mjs';
function fixture() {
  const store = createFirestoreStore(fakeFirestore());
  const verified = [];
  const auth = { async verifyIdToken(token, checkRevoked) { verified.push({ token, checkRevoked }); if (token === 'expired') throw new Error('expired'); return { uid: 'test-user', admin: token === 'admin' }; } };
  const api = createApi({ store, auth });
  const call = async (path, { method = 'GET', data, token, origin } = {}) => {
    const req = Readable.from(data === undefined ? [] : [Buffer.from(JSON.stringify(data))]);
    Object.assign(req, { url: '/api' + path, method, headers: { host: 'localhost:5173', ...(data ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) } });
    const headers = {};
    const res = { statusCode: 200, headersSent: false, setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); this.headersSent = true; } };
    await api(req, res); return { status: res.statusCode, body: res.body, headers };
  };
  return { call, store, verified };
}

test('Firebase API rejects missing, revoked and non-admin credentials before database access', async () => {
  const { call, verified } = fixture();
  for (const [token, status] of [[undefined, 401], ['expired', 401], ['ordinary-user', 403], ['admin', 200]]) {
    assert.equal((await call('/records/products', { token })).status, status);
  }
  assert.ok(verified.every(value => value.checkRevoked === true));
  assert.equal((await call('/setup', { method: 'POST', data: { email: 'other@example.test', password: 'not-used' } })).status, 401);
});

test('Fresh Firestore API exposes no private settings publicly and admin settings save flows into branding', async () => {
  const { call } = fixture();
  assert.deepEqual((await call('/branding')).body, { name: '', logo: '' });
  const profile = { name: 'Fresh business', instagram: 'fresh_business', tiktok: '@fresh_video', whatsapp: '+2348012345678', email: 'private@example.test', threshold: 8 };
  assert.equal((await call('/records/settings/business', { method: 'PUT', token: 'admin', data: profile })).status, 200);
  const branding = await call('/branding'); assert.deepEqual(branding.body, { name: 'Fresh business', logo: '' });
  assert.equal(branding.headers['cache-control'], 'no-store');
  assert.equal((await call('/records/settings/business')).status, 401);
  const manifest = await call('/manifest.webmanifest'); assert.equal(manifest.body.name, profile.name);
  assert.ok(manifest.body.icons.some(icon => icon.src === '/icon.svg' && icon.sizes === 'any'));
  assert.ok(manifest.body.icons.some(icon => icon.src === '/icon-512.png' && icon.purpose === 'any'));
  assert.equal((await call('/records/settings/business', { token: 'admin' })).body.tiktok, profile.tiktok);
});

test('Authenticated admin can create/read/update/delete records; cross-origin and workflow bypasses are denied', async () => {
  const { call, store } = fixture(); const token = 'admin';
  const expense = { title: 'Bottles', category: 'Packaging', amount: 5000, date: '2026-11-04' };
  assert.equal((await call('/records/expenses', { method: 'POST', data: expense, token, origin: 'https://untrusted.example' })).status, 403);
  const created = await call('/records/expenses', { method: 'POST', data: expense, token }); assert.equal(created.status, 201);
  assert.equal((await call('/records/expenses/' + created.body.id, { method: 'PATCH', data: { amount: 4000 }, token })).body.amount, 4000);
  assert.equal((await call('/records/expenses', { token })).body.length, 1);
  assert.equal((await call('/records/expenses/' + created.body.id, { method: 'DELETE', token })).status, 200);
  assert.deepEqual(await store.list('expenses'), []);
  assert.equal((await call('/records/sales/fake', { method: 'PATCH', token, data: { paid: 100 } })).status, 400);
  assert.equal((await call('/records/users', { token })).status, 404);
});

test('Firebase API awaits transaction results for sales, payments, refunds and backup', async () => {
  const { call } = fixture(); const token = 'admin';
  const product = await call('/records/products', { method: 'POST', token, data: { name: 'New perfume', quantity: 2, price: 1000, size: 50 } });
  const order = await call('/sales', { method: 'POST', token, data: { items: [{ productId: product.body.id, qty: 1, price: 1000 }], name: 'Buyer', discount: 0, delivery: 0, paid: 0, status: 'unpaid', method: 'Cash' } });
  assert.equal(order.status, 201); assert.equal(order.body.invoiceNo, 'INV-00001');
  const path = '/sales/' + order.body.id;
  assert.equal((await call(path + '/payment', { method: 'POST', token, data: { amount: 1000 } })).body.paid, 1000);
  const refund = await call(path + '/refunds', { method: 'POST', token, data: { requestId: 'confirm-1', amount: 1000, reason: 'Returned', returnStock: true } });
  assert.equal(refund.body.refunded, 1000); assert.equal(refund.body.cancelled, true);
  assert.equal((await call('/backup', { token })).body.sales[0].refunded, 1000);
  assert.equal((await call('/records/products/' + product.body.id, { token })).body.quantity, 2);
});
