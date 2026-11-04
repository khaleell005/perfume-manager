import { businessDefaults } from '../shared/business.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const check = (condition, message, status) => { if (!condition) throw new AppError(message, status); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const money = value => Number.isFinite(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const publicUser = user => ({ id: user.id, email: user.email, displayName: user.name });
const collections = new Set(['products', 'customers', 'expenses', 'settings', 'stockMovements', 'sales']);

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  const [salt, key] = stored.split(':');
  return timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(password, salt, 64));
}
function validatePassword(password) {
  check(typeof password === 'string' && password.length >= 8 && password.length <= 1024, 'Choose a password between 8 and 1024 characters.');
}

export function openStore(filename = process.env.SQLITE_PATH || 'data/perfume.sqlite') {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS documents (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (collection, id));
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
  `);
  const getRow = db.prepare('SELECT data FROM documents WHERE collection = ? AND id = ?');
  const putRow = db.prepare('INSERT INTO documents (collection, id, data) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data');
  const transaction = callback => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const get = (collection, id) => {
    const row = getRow.get(collection, id);
    return row ? { ...JSON.parse(row.data), id } : null;
  };
  const put = (collection, id, data) => {
    const { id: ignored, ...record } = data;
    putRow.run(collection, id, JSON.stringify(record));
    return { ...record, id };
  };
  const requireRecord = (collection, id) => { const record = get(collection, id); check(record, 'Record not found.', 404); return record; };
  const cleanProduct = data => ({ category: '', size: 50, threshold: get('settings', 'business')?.threshold ?? 5, quantity: 0, archived: false, createdAt: Date.now(), cost: 0, description: '', ...data, tracked: true, available: true });
  const normalizePhone = value => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.startsWith('0') ? '234' + digits.slice(1) : digits;
  };
  function saveCustomer(input) {
    if (!text(input.name)) return undefined;
    const name = input.name.trim();
    const phone = String(input.phone || '').trim(), email = String(input.email || '').trim(), address = String(input.address || '').trim();
    let customer = input.cid ? requireRecord('customers', input.cid) : null;
    if (!customer) customer = store.list('customers').find(c => phone ? normalizePhone(c.phone) === normalizePhone(phone) : email ? String(c.email || '').toLowerCase() === email.toLowerCase() : !c.phone && !c.email && c.name.trim().toLowerCase() === name.toLowerCase());
    return put('customers', customer?.id || randomUUID(), { name, phone: phone || customer?.phone || '', email: email || customer?.email || '', address: address || customer?.address || '', notes: customer?.notes || '', createdAt: customer?.createdAt || Date.now(), updatedAt: Date.now() }).id;
  }
  function returnStock(sale) {
    if (sale.cancelled) return;
    for (const item of sale.items) {
      if (!item.tracked || !item.productId) continue;
      const product = get('products', item.productId);
      if (!product) continue;
      put('products', product.id, { ...product, quantity: product.quantity + item.qty, updatedAt: Date.now() });
      put('stockMovements', randomUUID(), { productId: product.id, name: product.name, change: item.qty, type: 'refund', ref: sale.id, at: Date.now() });
    }
  }
  function validateRecord(collection, data) {
    check(object(data), 'Enter valid record details.');
    if (collection === 'products') {
      check(text(data.name), 'Enter a product name.');
      check(money(data.price) && money(data.cost) && money(data.size) && data.size > 0 && money(data.threshold), 'Enter valid product prices, size, and stock threshold.');
      check(Number.isInteger(data.quantity) && data.quantity >= 0, 'Quantity must be a whole number, zero or above.');
      check(['tracked', 'available', 'archived'].every(key => typeof data[key] === 'boolean'), 'Enter valid product availability.');
    } else if (collection === 'customers') {
      check(text(data.name), 'Enter a customer name.');
    } else if (collection === 'expenses') {
      check(text(data.title) && text(data.category) && money(data.amount) && data.amount > 0, 'Enter a title, category, and amount above zero.');
      check(typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date), 'Enter a valid expense date.');
    } else if (collection === 'settings') {
      check(money(data.threshold), 'Enter a valid stock threshold.');
    }
  }
  function createOwner({ email, password, name = 'Business owner' }) {
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
    validatePassword(password);
    return transaction(() => {
      check(!store.hasOwner(), 'This workspace already has an owner.', 409);
      const user = { id: randomUUID(), email, name: text(name) ? name.trim() : 'Business owner' };
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run(user.id, email, user.name, hashPassword(password));
      return publicUser(user);
    });
  }
  const store = {
    close: () => db.close(),
    hasOwner: () => !!db.prepare('SELECT id FROM users LIMIT 1').get(),
    createOwner,
    findOwner: email => { const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email); return user ? publicUser(user) : null; },
    authenticate(email, password) {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(typeof email === 'string' ? email.trim().toLowerCase() : '');
      // Verify a dummy hash too, so unknown users follow the same password-check path.
      const hash = user?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64);
      check(verifyPassword(password, hash) && user, 'Incorrect email or password.', 401);
      return publicUser(user);
    },
    createSession(userId) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hashToken(token), userId, Date.now() + 7 * 864e5);
      return token;
    },
    sessionUser(token) {
      if (!token) return null;
      const user = db.prepare('SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?').get(hashToken(token), Date.now());
      return user ? publicUser(user) : null;
    },
    deleteSession(token) { if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token)); },
    changePassword(userId, currentPassword, password) {
      validatePassword(password);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      check(user && verifyPassword(currentPassword, user.password_hash), 'Your current password is incorrect.', 401);
      transaction(() => {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      });
    },
    resetOwnerPassword(email, password) {
      validatePassword(password);
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      check(user, 'No owner account with that email exists.', 404);
      transaction(() => {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      });
    },
    list(collection) {
      check(collections.has(collection), 'Unknown collection.', 404);
      return db.prepare('SELECT id, data FROM documents WHERE collection = ? ORDER BY rowid').all(collection).map(row => ({ ...JSON.parse(row.data), id: row.id }));
    },
    get,
    create(collection, data) {
      check(['products', 'customers', 'expenses'].includes(collection), 'This record cannot be created directly.');
      if (collection === 'products') data = cleanProduct(data);
      validateRecord(collection, data);
      return put(collection, randomUUID(), data);
    },
    update(collection, id, data) {
      check(['products', 'customers', 'expenses'].includes(collection), 'This record cannot be edited directly.');
      check(object(data), 'Enter valid record details.');
      let record = { ...requireRecord(collection, id), ...data };
      if (collection === 'products') record = cleanProduct(record);
      validateRecord(collection, record);
      return put(collection, id, record);
    },
    saveSettings(data) {
      check(object(data), 'Enter valid business details.');
      const merged = { ...businessDefaults, ...get('settings', 'business'), ...data };
      const clean = {};
      for (const key of Object.keys(businessDefaults)) {
        if (key === 'threshold') continue;
        check(typeof merged[key] === 'string', 'Enter valid business details.');
        const value = merged[key].trim();
        check(value.length <= (key === 'logo' ? 1000000 : key === 'address' || key === 'thanks' ? 2000 : 300), 'A business detail is too long.');
        clean[key] = value;
      }
      check(!clean.logo || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(clean.logo), 'Upload a PNG, JPEG, or WebP logo.');
      check(Number.isInteger(merged.threshold) && merged.threshold >= 0, 'The stock threshold must be a whole number, zero or above.');
      clean.threshold = merged.threshold;
      return put('settings', 'business', clean);
    },
    deleteExpense(id) { requireRecord('expenses', id); db.prepare('DELETE FROM documents WHERE collection = ? AND id = ?').run('expenses', id); },
    changeStock(id, mode, amount) {
      check(['restock', 'adjust'].includes(mode) && Number.isInteger(amount) && amount >= (mode === 'restock' ? 1 : 0), 'Enter a valid whole-number stock quantity.');
      return transaction(() => {
        const product = requireRecord('products', id);
        check(product.tracked, 'This product does not track stock.');
        const quantity = mode === 'restock' ? product.quantity + amount : amount;
        const updated = put('products', id, { ...product, quantity, updatedAt: Date.now() });
        put('stockMovements', randomUUID(), { productId: id, name: product.name, change: quantity - product.quantity, type: mode, at: Date.now() });
        return updated;
      });
    },
    createSale(input) {
      check(object(input) && Array.isArray(input.items) && input.items.length > 0 && input.items.length <= 500, 'Add at least one item.');
      check(money(input.discount) && money(input.delivery) && money(input.paid), 'Enter valid payment, delivery, and discount amounts.');
      check(['name', 'phone', 'email', 'address', 'cid'].every(key => input[key] === undefined || typeof input[key] === 'string'), 'Enter valid customer details.');
      check(['paid', 'partial', 'unpaid'].includes(input.status) && text(input.method), 'Choose a payment status and method.');
      return transaction(() => {
        const required = new Map();
        const items = input.items.map(item => {
          check(object(item) && Number.isInteger(item.qty) && item.qty > 0 && money(item.price), 'Enter a valid quantity and price for every item.');
          let product;
          if (item.productId) {
            product = requireRecord('products', item.productId);
            check(!product.archived, `${product.name} is not available for sale.`);
            if (product.tracked) required.set(product.id, (required.get(product.id) || 0) + item.qty);
          }
          check(money(product?.size ?? item.size) && (product?.size ?? item.size) > 0, 'Enter a valid perfume size in ml.');
          check(product || text(item.name), 'Enter a name for personalized perfumes.');
          return { name: product?.name || item.name.trim(), qty: item.qty, price: item.price, size: product?.size ?? item.size ?? 0,
            ...(product ? { productId: product.id, tracked: product.tracked } : {}), ...(item.note ? { note: String(item.note) } : {}) };
        });
        for (const [id, qty] of required) {
          const product = requireRecord('products', id);
          check(product.quantity >= qty, `Not enough stock for ${product.name}.`);
        }
        const subtotal = items.reduce((n, item) => n + item.qty * item.price, 0);
        const total = Math.max(0, subtotal - input.discount + input.delivery);
        check(Number.isFinite(total), 'The sale total is too large.');
        const paid = input.status === 'paid' ? total : input.status === 'unpaid' ? 0 : Math.min(input.paid, total);
        const highestInvoice = store.list('sales').reduce((max, sale) => Math.max(max, Number(sale.invoiceNo?.match(/^INV-(\d+)$/)?.[1]) || 0), 0);
        const n = Math.max(get('settings', 'counter')?.n || 0, highestInvoice) + 1;
        const customerId = saveCustomer(input);
        const id = randomUUID();
        const sale = { invoiceNo: `INV-${String(n).padStart(5, '0')}`, items, subtotal, discount: input.discount, delivery: input.delivery,
          total, paid, method: input.method, status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
          customerId, customerName: input.name?.trim() || undefined, customerPhone: input.phone?.trim() || undefined, customerEmail: input.email?.trim() || undefined, customerAddress: input.address?.trim() || undefined, refunds: [], refunded: 0, createdAt: Date.now() };
        put('settings', 'counter', { n });
        for (const [productId, qty] of required) {
          const product = requireRecord('products', productId);
          put('products', productId, { ...product, quantity: product.quantity - qty, updatedAt: Date.now() });
          put('stockMovements', randomUUID(), { productId, name: product.name, change: -qty, type: 'sale', ref: id, at: Date.now() });
        }
        return put('sales', id, sale);
      });
    },
    cancelSale(id) {
      return transaction(() => {
        const sale = requireRecord('sales', id);
        if (sale.cancelled) return sale;
        returnStock(sale);
        return put('sales', id, { ...sale, cancelled: true });
      });
    },
    addPayment(id, amount) {
      check(money(amount) && amount > 0, 'Enter a payment amount above zero.');
      return transaction(() => {
        const sale = requireRecord('sales', id);
        check(!sale.cancelled, 'Cancelled sales cannot receive payments.');
        const paid = Math.min(sale.total, sale.paid + amount);
        return put('sales', id, { ...sale, paid, status: paid >= sale.total ? 'paid' : 'partial' });
      });
    },
    initiateRefund(id, input) {
      check(object(input) && money(input.amount) && input.amount > 0 && text(input.reason), 'Enter a refund amount above zero and a reason.');
      check(input.requestId === undefined || (typeof input.requestId === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(input.requestId)), 'Enter a valid refund confirmation reference.');
      return transaction(() => {
        const sale = requireRecord('sales', id);
        const refunds = sale.refunds || [];
        const amount = Math.round(input.amount * 100) / 100;
        const method = text(input.method) ? input.method.trim() : sale.method;
        const reference = String(input.reference || '').trim();
        const existing = input.requestId && refunds.find(refund => refund.requestId === input.requestId);
        if (existing) {
          check(existing.amount === amount && existing.reason === input.reason.trim() && existing.returnStock === !!input.returnStock && existing.method === method && existing.reference === reference, 'This refund confirmation was already recorded. Reload the invoice before making another refund.', 409);
          return sale;
        }
        const refunded = Math.round(refunds.filter(refund => refund.status === 'paid').reduce((total, refund) => total + refund.amount, 0) * 100) / 100;
        const remaining = Math.round((sale.paid - refunded) * 100) / 100;
        check(amount > 0 && amount <= remaining, 'The refund cannot exceed payments received minus previous refunds.');
        check(!input.returnStock || amount === remaining, 'Returning all items requires refunding the full remaining payment.');
        const now = Date.now();
        const refund = { id: randomUUID(), ...(input.requestId ? { requestId: input.requestId } : {}), amount, reason: input.reason.trim(), returnStock: !!input.returnStock, status: 'paid', method, reference, createdAt: now, resolvedAt: now };
        // Supersede unconfirmed requests from the old flow without counting them as payments.
        const updated = refunds.map(previous => previous.status === 'pending' ? { ...previous, status: 'cancelled', resolvedAt: now } : previous);
        const cancelled = sale.cancelled || refund.returnStock;
        if (cancelled && !sale.cancelled) returnStock(sale);
        return put('sales', id, { ...sale, refunds: [...updated, refund], refunded: Math.round((refunded + amount) * 100) / 100, ...(cancelled ? { cancelled: true } : {}) });
      });
    },
    resolveRefund(id, refundId, input) {
      check(object(input) && ['paid', 'cancelled'].includes(input.status), 'Choose a valid refund action.');
      if (input.status === 'paid') check(text(input.method), 'Choose how the money was returned.');
      return transaction(() => {
        const sale = requireRecord('sales', id);
        const refunds = sale.refunds || [];
        const refund = refunds.find(r => r.id === refundId);
        check(refund, 'Refund not found.', 404);
        if (refund.status === input.status) return sale;
        check(refund.status === 'pending', 'This refund has already been resolved.', 409);
        const updated = refunds.map(r => r.id === refundId ? { ...r, status: input.status, resolvedAt: Date.now(), ...(input.status === 'paid' ? { method: input.method.trim(), reference: String(input.reference || '').trim() } : {}) } : r);
        const refunded = Math.round(updated.filter(r => r.status === 'paid').reduce((n, r) => n + r.amount, 0) * 100) / 100;
        check(refunded <= sale.paid, 'Refunds cannot exceed the amount received.');
        const cancelled = sale.cancelled || (input.status === 'paid' && refund.returnStock);
        if (cancelled && !sale.cancelled) returnStock(sale);
        return put('sales', id, { ...sale, refunds: updated, refunded, ...(cancelled ? { cancelled: true } : {}) });
      });
    },
    backup() { return Object.fromEntries([...collections].map(name => [name, store.list(name)])); },
  };
  // Link historical named sales to the customer directory without changing invoice snapshots.
  transaction(() => {
    for (const sale of store.list('sales')) {
      if (text(sale.customerName) && (!sale.customerId || !get('customers', sale.customerId))) {
        const customerId = saveCustomer({ name: sale.customerName, phone: sale.customerPhone, email: sale.customerEmail, address: sale.customerAddress });
        put('sales', sale.id, { ...sale, customerId });
      }
    }
  });
  return store;
}
