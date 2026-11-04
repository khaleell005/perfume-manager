import type { Biz, Product, Sale, SaleItem } from '../../types';

export async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin',
    ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The workspace server is unavailable. Restart the app and try again.');
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !['/login', '/password'].includes(path)) window.dispatchEvent(new Event('session-expired'));
    throw new Error(result.error || 'The request could not be completed.');
  }
  if (method !== 'GET' && !['/login', '/setup', '/logout', '/password'].includes(path)) window.dispatchEvent(new Event('workspace-data-changed'));
  return result;
}
const recordPath = (collection: string, id?: string) => `/records/${encodeURIComponent(collection)}${id ? '/' + encodeURIComponent(id) : ''}`;
export const listRecords = <T>(collection: string) => request<(T & { id: string })[]>(recordPath(collection));
export const getRecord = <T>(collection: string, id: string) => request<T | null>(recordPath(collection, id));
export const createRecord = <T>(collection: string, data: T) => request<T & { id: string }>(recordPath(collection), 'POST', data);
export const updateRecord = (collection: string, id: string, data: unknown) => request(recordPath(collection, id), 'PATCH', data);
export const saveSettings = (data: unknown) => request<Biz>(recordPath('settings', 'business'), 'PUT', data);
export const deleteExpense = (id: string) => request(recordPath('expenses', id), 'DELETE');
export const changeStock = (id: string, mode: 'restock' | 'adjust', amount: number) => request<Product>(`/products/${id}/stock`, 'POST', { mode, amount });
export const createSale = (items: SaleItem[], details: unknown) => request<Sale & { id: string }>('/sales', 'POST', { ...(details as object), items });
export const cancelSale = (id: string) => request(`/sales/${id}/cancel`, 'POST');
export const addPayment = (id: string, amount: number) => request(`/sales/${id}/payment`, 'POST', { amount });
export const getBackup = () => request<Record<string, unknown[]>>('/backup');

export const initiateRefund = (id: string, details: unknown) => request<Sale & { id: string }>(`/sales/${id}/refunds`, 'POST', details);
export const resolveRefund = (id: string, refundId: string, details: unknown) => request<Sale & { id: string }>(`/sales/${id}/refunds/${refundId}`, 'POST', details);
