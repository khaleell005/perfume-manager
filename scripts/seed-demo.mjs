import { pathToFileURL } from 'node:url';
import { openStore } from '../server/database.mjs';
import { seedBusiness } from './seed-business.mjs';

const prefix = 'perfume-demo-v1';
const day = 86400000;
const key = (collection, name) => `${prefix}:${collection}:${name}`;
const date = timestamp => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(timestamp);

export function seedDemo(store, { now = Date.now() } = {}) {
  return store.withTransaction(() => {
    const profile = seedBusiness(store);
    const business = store.saveSettings({
      ...profile,
      instagram: profile.instagram || 'perfume_by_aysha_demo',
      tiktok: profile.tiktok || 'perfume_by_aysha_demo',
      whatsapp: profile.whatsapp || '+1 202-555-0199',
    });
    const added = { products: 0, customers: 0, sales: 0, expenses: 0, refunds: 0 };
    const findOrCreate = (collection, name, data) => {
      const demoKey = key(collection, name);
      const existing = store.list(collection).find(record => record.demoKey === demoKey);
      if (existing) return existing;
      const record = store.create(collection, { ...data, demo: true, demoKey });
      added[collection]++;
      return record;
    };
    const products = {};
    for (const [slug, name, category, size, price, quantity] of [
      ['love-struck', 'Love Struck', 'Signature', 50, 25000, 30],
      ['amber-oud', 'Amber & Oud', 'Woody', 100, 38000, 14],
      ['rose-atelier', 'Rose Atelier', 'Floral', 50, 32000, 4],
      ['soft-musk', 'Soft Musk', 'Musk', 30, 16500, 12],
      ['citrus-bloom', 'Citrus Bloom', 'Fresh', 50, 18000, 25],
      ['vanilla-noir', 'Vanilla Noir', 'Gourmand', 50, 28500, 18],
      ['velvet-jasmine', 'Velvet Jasmine', 'Floral', 50, 22000, 2],
      ['ocean-breeze', 'Ocean Breeze', 'Fresh', 100, 24000, 0],
    ]) products[slug] = findOrCreate('products', slug, { name, category, size, price, quantity, threshold: 5, createdAt: now - 7 * day, updatedAt: now });

    const customers = {};
    for (const [index, [slug, name, city]] of [
      ['amina', 'Amina Bello', 'Lagos'], ['zainab', 'Zainab Yusuf', 'Abuja'], ['fatima', 'Fatima Ibrahim', 'Kano'], ['maryam', 'Maryam Hassan', 'Kaduna'], ['hauwa', 'Hauwa Abdullahi', 'Lagos'],
    ].entries()) customers[slug] = findOrCreate('customers', slug, {
      name, phone: `+1 202-555-010${index + 1}`, email: `${slug}.demo@example.test`, address: `Demo delivery address, ${city}`,
      notes: 'Fictional demo customer. Contact details are examples.', createdAt: now - 7 * day, updatedAt: now,
    });

    const item = (slug, qty = 1) => ({ productId: products[slug].id, name: products[slug].name, size: products[slug].size, price: products[slug].price, qty });
    const orders = [
      { slug: 'today-love', days: 0, customer: 'amina', items: [item('love-struck', 2)], status: 'paid', method: 'Bank transfer' },
      { slug: 'today-rose-custom', days: 0, customer: 'zainab', items: [item('rose-atelier'), { name: 'Bespoke Rose Blend', size: 30, price: 18000, qty: 1 }], status: 'partial', paid: 20000, delivery: 1500, discount: 500, method: 'POS' },
      { slug: 'today-musk', days: 0, customer: 'fatima', items: [item('soft-musk')], status: 'unpaid', method: 'Bank transfer' },
      { slug: 'yesterday-oud', days: 1, customer: 'amina', items: [item('amber-oud')], status: 'paid', method: 'Cash' },
      { slug: 'yesterday-citrus', days: 1, customer: 'maryam', items: [item('citrus-bloom', 2)], status: 'partial', paid: 10000, method: 'Bank transfer' },
      { slug: 'vanilla-love', days: 2, customer: 'zainab', items: [item('vanilla-noir'), item('love-struck')], status: 'paid', method: 'POS' },
      { slug: 'refunded-musk', days: 3, customer: 'hauwa', items: [item('soft-musk')], status: 'paid', method: 'Cash', refund: true },
      { slug: 'jasmine', days: 4, customer: 'fatima', items: [item('velvet-jasmine')], status: 'unpaid', method: 'Bank transfer' },
      { slug: 'love-citrus', days: 5, customer: 'maryam', items: [item('love-struck'), item('citrus-bloom')], status: 'paid', method: 'Bank transfer' },
      { slug: 'oud-partial', days: 6, customer: 'hauwa', items: [item('amber-oud')], status: 'partial', paid: 15000, method: 'Cash' },
    ];
    for (const [index, order] of orders.entries()) {
      const demoKey = key('sales', order.slug);
      if (store.list('sales').some(sale => sale.demoKey === demoKey)) continue;
      const customer = customers[order.customer];
      const sale = store.createSale({ items: order.items, cid: customer.id, name: customer.name, phone: customer.phone, email: customer.email, address: customer.address,
        discount: order.discount || 0, delivery: order.delivery || 0, status: order.status, paid: order.paid || 0, method: order.method,
      }, { createdAt: now - order.days * day - index * 60000, demoKey });
      added.sales++;
      if (order.refund) {
        store.initiateRefund(sale.id, { requestId: 'demo-v1-refunded-musk', amount: sale.paid, reason: 'Demo: full return of an unopened bottle', method: 'Cash', returnStock: true });
        added.refunds++;
      }
    }
    for (const [slug, title, category, amount, days] of [
      ['oils', 'Demo · Perfume oil supplies', 'Perfume oils and ingredients', 18000, 6],
      ['bottles', 'Demo · Bottles and atomizers', 'Bottles and containers', 12000, 5],
      ['marketing', 'Demo · Social media promotion', 'Marketing and advertising', 6500, 4],
      ['delivery', 'Demo · Courier charges', 'Transportation and delivery', 3000, 2],
      ['packaging', 'Demo · Gift boxes and labels', 'Labels and packaging', 4500, 1],
      ['mixing', 'Demo · Mixing supplies', 'Alcohol and mixing supplies', 7500, 0],
    ]) findOrCreate('expenses', slug, { title, category, amount, date: date(now - days * day), description: 'Demo expense for exploring reports.' });
    return { business: business.name, added, totals: Object.fromEntries(['products', 'customers', 'sales', 'expenses'].map(collection => [collection, store.list(collection).length])) };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const store = openStore();
    try {
      const result = seedDemo(store);
      console.log(`Demo data ready for ${result.business}.`);
      console.log('Added: ' + Object.entries(result.added).map(([name, count]) => `${count} ${name}`).join(', '));
      console.log('Totals: ' + Object.entries(result.totals).map(([name, count]) => `${count} ${name}`).join(', '));
      console.log('Existing local SQLite records and owner credentials are preserved. The active Firebase workspace is unchanged.');
    } finally { store.close(); }
  } catch (error) { console.error('Demo seed failed:', error.message); process.exitCode = 1; }
}
