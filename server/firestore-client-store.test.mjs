import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFirestoreClientStore } from '../shared/firestore-client-store.mjs';
import { fakeFirestore } from './testing/memory-store.mjs';
function fixture() {
  const db = fakeFirestore();
  const decode = snapshot => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
  return createFirestoreClientStore({
    get: async (name, id) => decode(await db.doc(`${name}/${id}`).get()),
    list: async name => (await db.collection(name).get()).docs.map(decode),
    transaction: callback => db.runTransaction(transaction => callback({
      get: async (name, id) => decode(await transaction.get(db.doc(`${name}/${id}`))),
      set: (name, id, value) => transaction.set(db.doc(`${name}/${id}`), value),
      delete: (name, id) => transaction.delete(db.doc(`${name}/${id}`)),
    })),
  });
}
const sale = id => ({ items: [{ productId: id, qty: 1, price: 25000 }], name: 'Buyer', discount: 0, delivery: 0, paid: 0, status: 'paid', method: 'Cash' });
test('Browser Firestore adapter saves linked invoices atomically and rejects insufficient stock without partial writes', async () => {
  const store = fixture();
  const product = await store.create('products', { name: 'Love Struck', size: 50, price: 25000, quantity: 1 });
  await store.saveSettings({ name: 'Perfume by Aysha', instagram: 'aysha' });
  const order = await store.createSale(sale(product.id));
  assert.equal(order.invoiceNo, 'INV-00001');
  assert.equal((await store.get('products', product.id)).quantity, 0);
  assert.equal((await store.list('customers')).length, 1);
  const before = await store.backup();
  await assert.rejects(store.createSale(sale(product.id)), /Not enough stock/);
  assert.deepEqual(await store.backup(), before);
  assert.equal((await store.get('settings', '_revision')).n, 3);
});
test('Browser Firestore adapter confirms refunds once, restores stock once and supports expense deletion', async () => {
  const store = fixture(); const product = await store.create('products', { name: 'Love Struck', size: 50, price: 25000, quantity: 1 });
  const order = await store.createSale(sale(product.id));
  const details = { requestId: 'same-confirmation', amount: 25000, reason: 'Returned', returnStock: true, method: 'Cash' };
  await Promise.all([store.initiateRefund(order.id, details), store.initiateRefund(order.id, details)]);
  assert.equal((await store.get('sales', order.id)).refunded, 25000);
  assert.equal((await store.get('products', product.id)).quantity, 1);
  assert.equal((await store.get('sales', order.id)).refunds.length, 1);
  const expense = await store.create('expenses', { title: 'Bottles', category: 'Supplies', amount: 1000, date: '2026-11-04' });
  await store.deleteExpense(expense.id); assert.deepEqual(await store.list('expenses'), []);
  await assert.rejects(store.list('users'), /Unknown collection/);
});
