import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFirestoreStore } from './firestore-store.mjs';
import { fakeFirestore } from './testing/memory-store.mjs';
const fixture = () => createFirestoreStore(fakeFirestore());
const sale = (productId, overrides = {}) => ({ items: [{ productId, qty: 1, price: 20000 }], name: 'New customer', phone: '08012345678', discount: 0, delivery: 0, paid: 0, status: 'paid', method: 'Cash', ...overrides });

test('Firestore starts empty, persists CRUD/settings, and rejects unsupported collections and references', async () => {
  const store = fixture(); assert.equal(await store.get('settings', 'business'), null);
  assert.deepEqual(await store.list('sales'), []);
  const p = await store.create('products', { name: 'Love Struck', price: 20000, quantity: 2 });
  assert.equal((await store.update('products', p.id, { price: 21000 })).price, 21000);
  const saved = await store.saveSettings({ name: 'Fresh studio', instagram: '@studio', tiktok: 'studio', whatsapp: '+2348012345678', threshold: 7 });
  assert.equal(saved.instagram, '@studio'); assert.equal((await store.get('settings', 'business')).threshold, 7);
  const e = await store.create('expenses', { title: 'Packaging', category: 'Supplies', amount: 1000, date: '2026-11-04' });
  await store.deleteExpense(e.id); assert.deepEqual(await store.list('expenses'), []);
  await assert.rejects(store.list('users'), /Unknown collection/);
  await assert.rejects(store.get('settings', '../secret'), /Invalid record reference/);
});

test('Firestore commits each sale, stock movement, customer and invoice counter together; invalid sales leave no writes', async () => {
  const store = fixture();
  const p = await store.create('products', { name: 'Love Struck', price: 20000, quantity: 1 });
  const before = await store.backup();
  await assert.rejects(store.createSale(sale(p.id, { items: [{ productId: p.id, qty: 2, price: 20000 }] })), /Not enough stock/);
  assert.deepEqual(await store.backup(), before);
  const results = await Promise.allSettled([store.createSale(sale(p.id)), store.createSale(sale(p.id))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await store.list('sales'))[0].invoiceNo, 'INV-00001');
  assert.equal((await store.get('products', p.id)).quantity, 0);
  assert.equal((await store.list('customers')).length, 1); assert.equal((await store.list('stockMovements')).length, 1);
});

test('Firestore refund confirmation is immediate and idempotent and restores stock only once', async () => {
  const store = fixture(); const p = await store.create('products', { name: 'Love Struck', price: 20000, quantity: 2 });
  const order = await store.createSale(sale(p.id));
  const details = { requestId: 'refund-confirmation-1', amount: 20000, reason: 'Returned', returnStock: true, method: 'Cash' };
  await Promise.all([store.initiateRefund(order.id, details), store.initiateRefund(order.id, details)]);
  const refunded = await store.get('sales', order.id);
  assert.equal(refunded.refunded, 20000); assert.equal(refunded.cancelled, true); assert.equal(refunded.refunds.length, 1);
  assert.equal((await store.get('products', p.id)).quantity, 2);
  await assert.rejects(store.addPayment(order.id, 100), /Cancelled/);
});
