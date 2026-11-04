import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApi } from './api.mjs';
import { openStore } from './database.mjs';

function fixture(t) {
  const store = openStore(':memory:'); t.after(() => store.close());
  const api = createApi({ store });
  const call = async (path, { method = 'GET', data, cookie, origin } = {}) => {
    const req = Readable.from(data === undefined ? [] : [Buffer.from(JSON.stringify(data))]);
    Object.assign(req, { url: '/api' + path, method, headers: { host: 'localhost:5173', ...(data ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) }, socket: { remoteAddress: '127.0.0.1' } });
    const headers = {};
    const res = { statusCode: 200, headersSent: false, setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); this.headersSent = true; } };
    await api(req, res);
    return { status: res.statusCode, body: res.body, headers, cookie: headers['set-cookie']?.split(';')[0] };
  };
  return { call, store };
}
const credentials = { email: 'owner@example.com', password: 'a-long-owner-password' };

test('first-run setup, cookie authentication, persistence, logout, and login', async t => {
  const { call } = fixture(t);
  assert.deepEqual((await call('/session')).body, { user: null, setupRequired: true });
  assert.equal((await call('/records/products')).status, 401);
  const setup = await call('/setup', { method: 'POST', data: credentials });
  assert.equal(setup.status, 201); assert.match(setup.headers['set-cookie'], /HttpOnly; SameSite=Strict/);
  assert.equal((await call('/session', { cookie: setup.cookie })).body.user.email, credentials.email);
  assert.equal((await call('/setup', { method: 'POST', data: credentials })).status, 409);
  const customer = await call('/records/customers', { method: 'POST', data: { name: 'Amara' }, cookie: setup.cookie });
  assert.equal(customer.status, 201);
  assert.equal((await call('/records/customers', { cookie: setup.cookie })).body.length, 1);
  assert.equal((await call('/backup', { cookie: setup.cookie })).body.customers[0].name, 'Amara');
  await call('/logout', { method: 'POST', cookie: setup.cookie });
  assert.equal((await call('/records/customers', { cookie: setup.cookie })).status, 401);
  assert.equal((await call('/login', { method: 'POST', data: { ...credentials, password: 'wrong' } })).status, 401);
  assert.equal((await call('/login', { method: 'POST', data: credentials })).status, 200);
});

test('cross-origin writes are denied and direct sale edits cannot bypass stock', async t => {
  const { call } = fixture(t);
  assert.equal((await call('/setup', { method: 'POST', data: credentials, origin: 'http://elsewhere.test' })).status, 403);
  const { cookie } = await call('/setup', { method: 'POST', data: credentials });
  assert.equal((await call('/records/sales', { method: 'POST', data: { total: 0 }, cookie })).status, 400);
  assert.equal((await call('/records/sales/arbitrary', { method: 'PATCH', data: { cancelled: true }, cookie })).status, 400);
});

test('changing password keeps the current browser signed in with a new session', async t => {
  const { call } = fixture(t);
  const old = await call('/setup', { method: 'POST', data: credentials });
  const updated = await call('/password', { method: 'POST', data: { currentPassword: credentials.password, password: 'new-long-owner-password' }, cookie: old.cookie });
  assert.equal(updated.status, 200);
  assert.equal((await call('/session', { cookie: old.cookie })).body.user, null);
  assert.equal((await call('/session', { cookie: updated.cookie })).body.user.email, credentials.email);
});

test('a single authenticated refund confirmation immediately deducts money and is safe to retry', async t => {
  const { call } = fixture(t);
  assert.equal((await call('/sales/missing/refunds', { method: 'POST', data: {} })).status, 401);
  const { cookie } = await call('/setup', { method: 'POST', data: credentials });
  const created = await call('/sales', { method: 'POST', cookie, data: { items: [{ name: 'Blend', size: 50, qty: 1, price: 1000 }], name: 'Amara', phone: '08012345678', discount: 0, delivery: 0, paid: 0, status: 'paid', method: 'Cash' } });
  assert.equal(created.status, 201);
  const data = { requestId: 'confirmation-1', amount: 1000, reason: 'Return', returnStock: true };
  const confirmed = await call(`/sales/${created.body.id}/refunds`, { method: 'POST', cookie, data });
  assert.equal(confirmed.body.refunds[0].status, 'paid');
  assert.equal(confirmed.body.refunded, 1000);
  assert.equal(confirmed.body.cancelled, true);
  const retry = await call(`/sales/${created.body.id}/refunds`, { method: 'POST', cookie, data });
  assert.equal(retry.status, 200); assert.equal(retry.body.refunds.length, 1);
});

test('saved business details update authenticated settings, public branding, and installation name', async t => {
  const { call } = fixture(t);
  const { cookie } = await call('/setup', { method: 'POST', data: credentials });
  const profile = { name: '  Perfume by Aysha  ', phone: '08012345678', whatsapp: '08012345678', email: 'test@example.com', address: 'Test address', social: '@test', instagram: ' @ayshaperfumes ', tiktok: 'ayshafragrances', thanks: 'Thank you!', threshold: 8, logo: '' };
  const saved = await call('/records/settings/business', { method: 'PUT', cookie, data: profile });
  assert.equal(saved.status, 200); assert.equal(saved.body.name, 'Perfume by Aysha');
  assert.equal(saved.body.instagram, '@ayshaperfumes');
  assert.equal(saved.body.tiktok, 'ayshafragrances');
  const branding = await call('/branding');
  assert.deepEqual(branding.body, { name: 'Perfume by Aysha', logo: '' });
  assert.equal(branding.headers['cache-control'], 'no-store');
  assert.equal((await call('/records/settings/business')).status, 401);
  const manifest = await call('/manifest.webmanifest');
  assert.equal(manifest.body.name, 'Perfume by Aysha');
  assert.match(manifest.headers['content-type'], /application\/manifest\+json/);
  const settings = (await call('/records/settings/business', { cookie })).body;
  assert.equal(settings.whatsapp, profile.whatsapp);
  assert.equal(settings.instagram, '@ayshaperfumes');
  assert.equal(settings.tiktok, profile.tiktok);
  assert.equal((await call('/records/settings/business', { method: 'PUT', cookie, data: { ...profile, threshold: -1 } })).status, 400);
  assert.equal((await call('/records/settings/business', { cookie })).body.threshold, 8);
  const product = await call('/records/products', { method: 'POST', cookie, data: { name: 'Rose', size: 50, price: 10000, quantity: 5 } });
  assert.equal(product.status, 201);
  assert.equal(product.body.threshold, 8);
});

test('full name updates only the authenticated profile and survives a fresh login', async t => {
  const { call, store } = fixture(t);
  assert.equal((await call('/profile', { method: 'PATCH', data: { name: 'Aisha Ibrahim' } })).status, 401);
  const { cookie } = await call('/setup', { method: 'POST', data: credentials });
  const saved = await call('/profile', { method: 'PATCH', cookie, data: { name: '  Aisha Ibrahim  ', email: 'other@example.test' } });
  assert.equal(saved.status, 200); assert.equal(saved.body.user.displayName, 'Aisha Ibrahim');
  assert.equal(saved.body.user.email, credentials.email);
  assert.equal(store.get('settings', 'business'), null);
  assert.equal((await call('/session', { cookie })).body.user.displayName, 'Aisha Ibrahim');
  assert.equal((await call('/profile', { method: 'PATCH', cookie, data: { name: ' ' } })).status, 400);
  assert.equal((await call('/profile', { method: 'PATCH', cookie, data: { name: 'a'.repeat(121) } })).status, 400);
  await call('/logout', { method: 'POST', cookie });
  const login = await call('/login', { method: 'POST', data: credentials });
  assert.equal(login.body.user.displayName, 'Aisha Ibrahim');
});
