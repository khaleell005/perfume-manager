import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore } from './testing/memory-store.mjs';
const fixture = () => memoryStore();
const product = { name: 'Amber & Oud', category: 'Signature', size: 50, price: 28000, cost: 10000, quantity: 5, tracked: true, threshold: 2, archived: false, available: true, description: '', createdAt: 0, updatedAt: 0 };
function sale(items, overrides = {}) { return { items: items.map(item => ({ size: 50, ...item })), discount: 0, delivery: 0, paid: 0, status: 'paid', method: 'Cash', ...overrides }; }


test('sales deduct stock atomically and use sequential invoices', t => {
  const store = fixture(t); const p = store.create('products', product);
  const first = store.createSale(sale([{ productId: p.id, qty: 2, price: p.price }]));
  assert.equal(first.invoiceNo, 'INV-00001'); assert.equal(first.total, 56000); assert.equal(first.paid, 56000);
  assert.equal(store.get('products', p.id).quantity, 3);
  assert.equal(store.list('stockMovements')[0].change, -2);
  const second = store.createSale(sale([{ name: 'Personalized blend', qty: 1, price: 1000, size: 30 }], { status: 'partial', paid: 200, discount: 100, delivery: 50 }));
  assert.equal(second.invoiceNo, 'INV-00002'); assert.equal(second.total, 950); assert.equal(second.status, 'partial');
});

test('insufficient stock rolls back the invoice, inventory, and movements', t => {
  const store = fixture(t); const p = store.create('products', product);
  assert.throws(() => store.createSale(sale([{ productId: p.id, qty: 6, price: 100 }])), /Not enough stock/);
  assert.equal(store.get('products', p.id).quantity, 5);
  assert.equal(store.get('settings', 'counter'), null);
  assert.equal(store.list('sales').length, 0); assert.equal(store.list('stockMovements').length, 0);
});

test('duplicate lines share a stock limit and client flags cannot bypass inventory', t => {
  const store = fixture(t); const p = store.create('products', product);
  assert.throws(() => store.createSale(sale([{ productId: p.id, qty: 3, price: 1 }, { productId: p.id, qty: 3, price: 1 }])), /Not enough stock/);
  store.createSale(sale([{ productId: p.id, tracked: false, qty: 2, price: 1 }]));
  assert.equal(store.get('products', p.id).quantity, 3);
});

test('cancelling twice restores stock only once and blocks further payments', t => {
  const store = fixture(t); const p = store.create('products', product);
  const s = store.createSale(sale([{ productId: p.id, qty: 2, price: 100 }], { status: 'unpaid' }));
  store.cancelSale(s.id); store.cancelSale(s.id);
  assert.equal(store.get('products', p.id).quantity, 5);
  assert.equal(store.list('stockMovements').length, 2);
  assert.throws(() => store.addPayment(s.id, 10), /Cancelled/);
});

test('payments accumulate from current balances and stop at the sale total', t => {
  const store = fixture(t);
  const s = store.createSale(sale([{ name: 'Blend', qty: 1, price: 1000 }], { status: 'unpaid' }));
  assert.equal(store.addPayment(s.id, 200).status, 'partial');
  assert.equal(store.addPayment(s.id, 300).paid, 500);
  assert.equal(store.addPayment(s.id, 9999).paid, 1000);
  assert.equal(store.get('sales', s.id).status, 'paid');
});

test('restock and adjustments record exact inventory changes', t => {
  const store = fixture(t); const p = store.create('products', product);
  store.changeStock(p.id, 'restock', 4); store.changeStock(p.id, 'adjust', 2);
  assert.equal(store.get('products', p.id).quantity, 2);
  assert.deepEqual(store.list('stockMovements').map(m => m.change), [4, -7]);
  assert.throws(() => store.changeStock(p.id, 'adjust', -1), /valid whole-number/);
});

test('invalid values and archived products cannot create sales', t => {
  const store = fixture(t); const p = store.create('products', product);
  assert.throws(() => store.createSale(sale([{ name: 'Blend', qty: -1, price: 2 }])), /valid quantity/);
  assert.throws(() => store.createSale(sale([{ name: 'Blend', qty: 1, price: 2 }], { discount: -1 })), /valid payment/);
  store.update('products', p.id, { archived: true });
  assert.throws(() => store.createSale(sale([{ productId: p.id, qty: 1, price: 2 }])), /not available/);
  assert.throws(() => store.create('sales', {}), /cannot be created directly/);
  assert.throws(() => store.update('settings', 'counter', { n: 0 }), /cannot be edited directly/);
});

test('products need only selling and stock details; hidden legacy fields are normalized', t => {
  const store = fixture(t);
  const p = store.create('products', { name: 'Love Struck', size: 50, price: 25000, quantity: 8 });
  assert.equal(p.tracked, true); assert.equal(p.available, true); assert.equal(p.cost, 0); assert.equal(p.description, '');
  assert.equal(p.threshold, 5);
});

test('sales remember new customers and reuse returning contacts without changing past invoices', t => {
  const store = fixture(t);
  const item = [{ name: 'Custom blend', size: 50, qty: 1, price: 1000 }];
  const first = store.createSale(sale(item, { name: 'Amara', phone: '08012345678', email: 'amara@example.com', address: 'Lagos' }));
  assert.equal(store.list('customers').length, 1);
  const second = store.createSale(sale(item, { name: 'Amara Okafor', phone: '+2348012345678' }));
  assert.equal(first.customerId, second.customerId);
  assert.equal(store.list('customers').length, 1);
  assert.equal(store.get('customers', first.customerId).email, 'amara@example.com');
  assert.equal(store.get('sales', first.id).customerName, 'Amara');
  store.createSale(sale(item, { name: 'Amara', phone: '08099999999' }));
  assert.equal(store.list('customers').length, 2);
});

test('failed sales do not save customer details', t => {
  const store = fixture(t); const p = store.create('products', product);
  assert.throws(() => store.createSale(sale([{ productId: p.id, qty: 99, price: 100 }], { name: 'Not saved', phone: '08012345678' })), /Not enough/);
  assert.equal(store.list('customers').length, 0);
});

test('confirming a refund immediately records its amount and restores stock once when requested', t => {
  const store = fixture(t); const p = store.create('products', product);
  const s = store.createSale(sale([{ productId: p.id, size: 50, qty: 2, price: 1000 }], { status: 'partial', paid: 500 }));
  assert.throws(() => store.initiateRefund(s.id, { amount: 501, reason: 'Return' }), /cannot exceed/);
  const details = { requestId: 'confirm-1', amount: 500, reason: 'Full return', returnStock: true, method: 'Cash' };
  const refunded = store.initiateRefund(s.id, details);
  assert.equal(refunded.refunded, 500); assert.equal(refunded.cancelled, true);
  assert.equal(refunded.refunds[0].status, 'paid');
  assert.equal(store.get('products', p.id).quantity, 5);
  assert.equal(store.list('stockMovements').length, 2);
  const repeated = store.initiateRefund(s.id, details);
  assert.equal(repeated.refunds.length, 1);
  assert.equal(store.get('products', p.id).quantity, 5);
  assert.throws(() => store.addPayment(s.id, 1), /Cancelled/);
});

test('partial refunds immediately reduce net receipts and never exceed the amount received', t => {
  const store = fixture(t); const p = store.create('products', product);
  const s = store.createSale(sale([{ productId: p.id, qty: 1, price: 1000 }]));
  assert.throws(() => store.initiateRefund(s.id, { amount: 200, reason: 'Adjustment', returnStock: true }), /full remaining/);
  const first = store.initiateRefund(s.id, { amount: 200, reason: 'Adjustment', method: 'Bank transfer', reference: 'REF-1' });
  assert.equal(first.refunded, 200); assert.equal(first.paid - first.refunded, 800);
  assert.equal(first.total - first.refunded, 800);
  assert.equal(first.refunds[0].method, 'Bank transfer');
  assert.equal(store.get('products', p.id).quantity, 4);
  assert.throws(() => store.initiateRefund(s.id, { amount: 801, reason: 'Too much' }), /cannot exceed/);
  const second = store.initiateRefund(s.id, { amount: 800, reason: 'Remaining return', returnStock: true });
  assert.equal(second.refunded, 1000);
  assert.equal(second.refunds.every(refund => refund.status === 'paid'), true);
  assert.equal(store.get('products', p.id).quantity, 5);
});

test('retrying a partial-refund confirmation does not deduct money twice', t => {
  const store = fixture(t);
  const s = store.createSale(sale([{ name: 'Blend', size: 50, qty: 1, price: 1000 }]));
  const details = { requestId: 'retry-1', amount: 200, reason: 'Adjustment', method: 'Cash' };
  store.initiateRefund(s.id, details);
  const repeated = store.initiateRefund(s.id, details);
  assert.equal(repeated.refunded, 200); assert.equal(repeated.refunds.length, 1);
  assert.throws(() => store.initiateRefund(s.id, { ...details, amount: 300 }), /already recorded/);
  assert.equal(store.initiateRefund(s.id, { ...details, requestId: 'retry-2' }).refunded, 400);
});

test('unpaid invoices cannot be refunded and invalid confirmations leave no changes', t => {
  const store = fixture(t);
  const s = store.createSale(sale([{ name: 'Blend', size: 50, qty: 1, price: 1000 }], { status: 'unpaid' }));
  assert.throws(() => store.initiateRefund(s.id, { amount: 100, reason: 'Return' }), /cannot exceed/);
  assert.throws(() => store.initiateRefund(s.id, { amount: -100, reason: 'Return' }), /above zero/);
  assert.equal(store.get('sales', s.id).refunded, 0);
  assert.equal(store.get('sales', s.id).refunds.length, 0);
});

test('cent rounding allows fractional refunds to exactly exhaust a payment immediately', t => {
  const store = fixture(t);
  const s = store.createSale(sale([{ name: 'Blend', size: 1, qty: 1, price: 0.3 }]));
  store.initiateRefund(s.id, { amount: 0.1, reason: 'Partial' });
  assert.equal(store.initiateRefund(s.id, { amount: 0.2, reason: 'Remaining' }).refunded, 0.3);
});
