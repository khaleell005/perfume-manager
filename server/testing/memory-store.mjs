import { createWorkspaceStore } from '../workspace.mjs';
export function memoryStore() {
  let records = new Map();
  const key = (name, id) => `${name}/${id}`;
  return createWorkspaceStore({
    get: (name, id) => structuredClone(records.get(key(name, id)) || null),
    list: name => [...records].filter(([path]) => path.startsWith(name + '/')).map(([, data]) => structuredClone(data)),
    put(name, id, data) { const record = JSON.parse(JSON.stringify({ ...data, id })); records.set(key(name, id), record); return structuredClone(record); },
    remove: (name, id) => records.delete(key(name, id)),
    transaction(callback) { const before = structuredClone(records); try { return callback(); } catch (error) { records = before; throw error; } },
  });
}
export function fakeFirestore() {
  const records = new Map();
  let queue = Promise.resolve();
  const snapshot = path => ({ exists: records.has(path), id: path.split('/')[1], data: () => structuredClone(records.get(path)) });
  const collection = name => ({ name, doc: id => doc(`${name}/${id}`), async get() { return { docs: [...records.keys()].filter(path => path.startsWith(name + '/')).map(snapshot) }; } });
  const doc = path => ({ path, get: async () => snapshot(path) });
  return {
    collection, doc,
    async runTransaction(callback) {
      const operation = queue.then(async () => {
        const writes = new Map(); let writing = false;
        const result = await callback({
          async get(reference) { if (writing) throw new Error('Firestore reads must happen before writes.'); return reference.get(); },
          set(reference, data) { writing = true; writes.set(reference.path, structuredClone(data)); },
          delete(reference) { writing = true; writes.set(reference.path, null); },
        });
        for (const [path, value] of writes) { if (value === null) records.delete(path); else records.set(path, value); }
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
