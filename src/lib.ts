import { useCallback, useEffect, useState } from 'react';
import { getRecord, listRecords } from './api';
import { businessDefaults } from '../shared/business.mjs';
import type { Biz } from './types';

export const ngn = (n: number) => '₦' + (n || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const num = (v: string) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

export async function runAction(action: () => Promise<unknown>) {
  try { await action(); }
  catch (error) { window.dispatchEvent(new CustomEvent('workspace-error', { detail: (error as Error).message || 'Unable to save your changes. Please try again.' })); }
}

export function useCol<T>(name: string) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await listRecords<T>(name)); }
    catch (error) { window.dispatchEvent(new CustomEvent('workspace-error', { detail: (error as Error).message })); }
    finally { setLoading(false); }
  }, [name]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, reload };
}

export const emptyBiz: Biz = { ...businessDefaults };
export async function getBiz(): Promise<Biz> {
  return { ...emptyBiz, ...await getRecord<Partial<Biz>>('settings', 'business') };
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
  a.download = `${name}.csv`;
  a.click();
}

export const waLink = (phone: string) => {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = '234' + d.slice(1);
  return `https://wa.me/${d}`;
};
