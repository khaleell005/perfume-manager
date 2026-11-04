import { collection, doc, getDocFromServer, getDocsFromServer, runTransaction, type DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import type { WorkspaceRecord } from '../../../server/workspace.mjs';
import { createFirestoreClientStore } from '../../../shared/firestore-client-store.mjs';
import type { Biz, Product, Sale, SaleItem } from '../../types';

const decode = (snapshot: DocumentSnapshot): WorkspaceRecord | null => snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
const store = createFirestoreClientStore({
  get: async (name, id) => decode(await getDocFromServer(doc(db, name, id))),
  list: async name => (await getDocsFromServer(collection(db, name))).docs.map(snapshot => decode(snapshot)!),
  transaction: callback => runTransaction(db, transaction => callback({
    get: async (name, id) => decode(await transaction.get(doc(db, name, id))),
    set: (name, id, value) => { transaction.set(doc(db, name, id), value); },
    delete: (name, id) => { transaction.delete(doc(db, name, id)); },
  })),
});
async function asAdmin<T>(action: () => Promise<T>) {
  await auth.authStateReady();
  if (!auth.currentUser || (await auth.currentUser.getIdTokenResult()).claims.admin !== true) throw new Error('Sign in with your admin account.');
  try { return await action(); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'permission-denied') throw new Error('Your account does not have permission to access these business records.');
    if (code === 'unavailable') throw new Error('Unable to connect to Firebase. Check your internet connection and try again.');
    throw error;
  }
}

// The Firebase build talks to Firestore directly, using the signed-in admin's rules.
// Branding on the sign-in screen is public artwork; private settings load after sign-in.
export async function request<T>(path: string): Promise<T> {
  if (path === '/branding') return { name: 'Perfume by Aysha', logo: '/brand-logo.jpg' } as T;
  throw new Error('Unknown workspace request.');
}
export const listRecords = <T>(name: string) => asAdmin(() => store.list(name)) as Promise<(T & { id: string })[]>;
export const getRecord = <T>(name: string, id: string) => asAdmin(() => store.get(name, id)) as Promise<T | null>;
async function write<T>(method: string, ...args: unknown[]): Promise<T> {
  const result = await asAdmin(() => store[method](...args));
  window.dispatchEvent(new Event('workspace-data-changed'));
  return result as T;
}
export const createRecord = <T>(name: string, data: T) => write<T & { id: string }>('create', name, data);
export const updateRecord = (name: string, id: string, data: unknown) => write('update', name, id, data);
export const saveSettings = (data: unknown) => write<Biz>('saveSettings', data);
export const deleteExpense = (id: string) => write('deleteExpense', id);
export const changeStock = (id: string, mode: 'restock' | 'adjust', amount: number) => write<Product>('changeStock', id, mode, amount);
export const createSale = (items: SaleItem[], details: unknown) => write<Sale & { id: string }>('createSale', { ...(details as object), items });
export const cancelSale = (id: string) => write('cancelSale', id);
export const addPayment = (id: string, amount: number) => write('addPayment', id, amount);
export const initiateRefund = (id: string, details: unknown) => write<Sale & { id: string }>('initiateRefund', id, details);
export const resolveRefund = (id: string, refundId: string, details: unknown) => write<Sale & { id: string }>('resolveRefund', id, refundId, details);
export const getBackup = () => asAdmin(() => store.backup()) as Promise<Record<string, unknown[]>>;
