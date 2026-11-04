const randomUUID = () => globalThis.crypto.randomUUID();
import { businessDefaults } from '../shared/business.mjs';
import { AppError } from './errors.mjs';
export { AppError } from './errors.mjs';
export const workspaceCollections = ['products', 'customers', 'expenses', 'settings', 'stockMovements', 'sales'];
const collections = new Set(workspaceCollections);
const check = (condition, message, status) => { if (!condition) throw new AppError(message, status); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const money = value => Number.isFinite(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;

// Pure business operations shared by the Firestore adapter and isolated tests.
// The adapter commits all changes together after this synchronous operation succeeds.
export function createWorkspaceStore({ get, put, list, remove, transaction = callback => callback() }) {
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
    return put('customers', customer?.id || randomUUID(), { ...customer, name, phone: phone || customer?.phone || '', email: email || customer?.email || '', address: address || customer?.address || '', notes: customer?.notes || '', createdAt: customer?.createdAt || Date.now(), updatedAt: Date.now() }).id;
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
  const store = {
    withTransaction: callback => transaction(() => callback(store)),
    list(collection) { check(collections.has(collection), 'Unknown collection.', 404); return list(collection); },
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
    deleteExpense(id) { requireRecord('expenses', id); remove('expenses', id); },
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
    createSale(input, options = {}) {
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
        const createdAt = options.createdAt ?? Date.now();
        const sale = { invoiceNo: `INV-${String(n).padStart(5, '0')}`, items, subtotal, discount: input.discount, delivery: input.delivery,
          total, paid, method: input.method, status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
          customerId, customerName: input.name?.trim() || undefined, customerPhone: input.phone?.trim() || undefined, customerEmail: input.email?.trim() || undefined, customerAddress: input.address?.trim() || undefined, refunds: [], refunded: 0, createdAt,
          ...(options.demoKey ? { demo: true, demoKey: options.demoKey } : {}) };
        put('settings', 'counter', { n });
        for (const [productId, qty] of required) {
          const product = requireRecord('products', productId);
          put('products', productId, { ...product, quantity: product.quantity - qty, updatedAt: Date.now() });
          put('stockMovements', randomUUID(), { productId, name: product.name, change: -qty, type: 'sale', ref: id, at: createdAt, ...(options.demoKey ? { demo: true } : {}) });
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
  return store;
}
