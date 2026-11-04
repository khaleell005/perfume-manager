import { firebaseServices } from './firebase-admin.mjs';
import { AppError, createWorkspaceStore, workspaceCollections } from './workspace.mjs';
const allowed = new Set(workspaceCollections);
const validateCollection = collection => { if (!allowed.has(collection)) throw new AppError('Unknown collection.', 404); };
const validateId = id => { if (typeof id !== 'string' || !id || id.includes('/') || id === '.' || id === '..') throw new AppError('Invalid record reference.'); };
const decode = doc => doc.exists ? { ...doc.data(), id: doc.id } : null;
const clean = data => JSON.parse(JSON.stringify(data));

export function createFirestoreStore(db = firebaseServices().db) {
  const store = {
    async list(collection) { validateCollection(collection); return (await db.collection(collection).get()).docs.map(decode); },
    async get(collection, id) { validateCollection(collection); validateId(id); return decode(await db.collection(collection).doc(id).get()); },
    async backup() { return Object.fromEntries(await Promise.all(workspaceCollections.map(async collection => [collection, await store.list(collection)]))); },
  };
  const write = (method, args, readCollections) => db.runTransaction(async transaction => {
    const snapshots = await Promise.all(readCollections.map(name => transaction.get(db.collection(name))));
    const records = new Map(readCollections.map((name, index) => [name, new Map(snapshots[index].docs.map(doc => [doc.id, decode(doc)]))]));
    const writes = new Map();
    const bucket = name => { validateCollection(name); if (!records.has(name)) records.set(name, new Map()); return records.get(name); };
    const engine = createWorkspaceStore({
      get: (name, id) => bucket(name).get(id) || null,
      list: name => [...bucket(name).values()],
      put(name, id, data) {
        validateId(id);
        const { id: ignored, ...value } = clean(data);
        const record = { ...value, id };
        bucket(name).set(id, record); writes.set(`${name}/${id}`, value); return record;
      },
      remove(name, id) { bucket(name).delete(id); writes.set(`${name}/${id}`, null); },
    });
    const result = engine[method](...args);
    for (const [path, value] of writes) {
      if (value === null) transaction.delete(db.doc(path));
      else transaction.set(db.doc(path), value);
    }
    return result;
  });
  Object.assign(store, {
    create(collection, data) { validateCollection(collection); return write('create', [collection, data], [collection, 'settings']); },
    update(collection, id, data) { validateCollection(collection); validateId(id); return write('update', [collection, id, data], [collection, 'settings']); },
    saveSettings: data => write('saveSettings', [data], ['settings']),
    deleteExpense: id => write('deleteExpense', [id], ['expenses']),
    changeStock: (id, mode, amount) => write('changeStock', [id, mode, amount], ['products']),
    createSale: input => write('createSale', [input], ['products', 'customers', 'sales', 'settings']),
    cancelSale: id => write('cancelSale', [id], ['sales', 'products']),
    addPayment: (id, amount) => write('addPayment', [id, amount], ['sales']),
    initiateRefund: (id, input) => write('initiateRefund', [id, input], ['sales', 'products']),
    resolveRefund: (id, refundId, input) => write('resolveRefund', [id, refundId, input], ['sales', 'products']),
  });
  return store;
}
