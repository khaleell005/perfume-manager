import { createWorkspaceStore, workspaceCollections } from '../server/workspace.mjs';
const allowed = new Set(workspaceCollections);
const checkCollection = name => { if (!allowed.has(name)) throw new Error('Unknown collection.'); };
const checkId = id => { if (typeof id !== 'string' || !id || id.includes('/') || id === '.' || id === '..') throw new Error('Invalid record reference.'); };
const clean = data => JSON.parse(JSON.stringify(data));

export function createFirestoreClientStore(io) {
  const store = {
    async list(name) { checkCollection(name); return io.list(name); },
    async get(name, id) { checkCollection(name); checkId(id); return io.get(name, id); },
    async backup() { return Object.fromEntries(await Promise.all(workspaceCollections.map(async name => [name, await io.list(name)]))); },
  };
  const write = (method, args, names) => io.transaction(async transaction => {
    // Every app mutation updates this revision. Concurrent inserts trigger a retry
    // that reloads collection membership as well as individual document values.
    const revision = await transaction.get('settings', '_revision');
    const queries = await Promise.all(names.map(name => io.list(name)));
    const records = new Map();
    for (const [index, query] of queries.entries()) {
      const snapshots = await Promise.all(query.map(record => transaction.get(names[index], record.id)));
      records.set(names[index], new Map(snapshots.filter(Boolean).map(record => [record.id, record])));
    }
    const writes = new Map();
    const bucket = name => {
      checkCollection(name);
      if (!records.has(name)) records.set(name, new Map());
      return records.get(name);
    };
    const engine = createWorkspaceStore({
      get: (name, id) => bucket(name).get(id) || null,
      list: name => [...bucket(name).values()],
      put(name, id, data) {
        checkId(id);
        const { id: ignored, ...value } = clean(data);
        const record = { ...value, id };
        bucket(name).set(id, record); writes.set(`${name}/${id}`, { name, id, value }); return record;
      },
      remove(name, id) { bucket(name).delete(id); writes.set(`${name}/${id}`, { name, id, value: null }); },
    });
    const result = engine[method](...args);
    for (const { name, id, value } of writes.values()) {
      if (value === null) transaction.delete(name, id);
      else transaction.set(name, id, value);
    }
    transaction.set('settings', '_revision', { n: Number(revision?.n || 0) + 1 });
    return result;
  });
  return Object.assign(store, {
    create(name, data) { checkCollection(name); return write('create', [name, data], [name, 'settings']); },
    update(name, id, data) { checkCollection(name); checkId(id); return write('update', [name, id, data], [name, 'settings']); },
    saveSettings: data => write('saveSettings', [data], ['settings']),
    deleteExpense: id => write('deleteExpense', [id], ['expenses']),
    changeStock: (id, mode, amount) => write('changeStock', [id, mode, amount], ['products']),
    createSale: input => write('createSale', [input], ['products', 'customers', 'sales', 'settings']),
    cancelSale: id => write('cancelSale', [id], ['sales', 'products']),
    addPayment: (id, amount) => write('addPayment', [id, amount], ['sales']),
    initiateRefund: (id, input) => write('initiateRefund', [id, input], ['sales', 'products']),
    resolveRefund: (id, refundId, input) => write('resolveRefund', [id, refundId, input], ['sales', 'products']),
  });
}
