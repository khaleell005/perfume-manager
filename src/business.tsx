import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { getRecord, request, saveSettings } from './api';
import { onSessionChanged } from './auth';
import { businessDefaults } from '../shared/business.mjs';
import type { Biz } from './types';

interface BusinessContext {
  business: Biz; loading: boolean; error: string;
  refresh: () => Promise<void>; save: (business: Biz) => Promise<Biz>;
}
const Context = createContext<BusinessContext>({ business: { ...businessDefaults }, loading: true, error: '', refresh: async () => {}, save: async business => business });
export const useBusiness = () => useContext(Context);
export function BusinessProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<Biz>({ ...businessDefaults });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const authenticated = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const data = authenticated.current ? await getRecord<Biz>('settings', 'business') : await request<Pick<Biz, 'name' | 'logo'>>('/branding');
      if (current === version.current) { setBusiness({ ...businessDefaults, ...data }); setError(''); }
    } catch (error) { if (current === version.current) setError((error as Error).message || 'Unable to load business details.'); }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    const unsubscribe = onSessionChanged(session => { if (active) { authenticated.current = !!session.user; void refresh(); } }, () => { if (active) void refresh(); });
    const storage = (event: StorageEvent) => { if (event.key === 'perfume-business-updated') void refresh(); };
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; version.current++; unsubscribe(); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => {
    const name = business.name || 'Perfume Manager';
    document.title = name;
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name);
    // Ask the browser to re-read the current business name for app installation.
    document.querySelector('link[rel="manifest"]')?.setAttribute('href', `/api/manifest.webmanifest?updated=${Date.now()}`);
  }, [business.name]);
  const save = async (value: Biz) => {
    const saved = await saveSettings(value);
    version.current++;
    setBusiness({ ...businessDefaults, ...saved }); setLoading(false); setError('');
    try { localStorage.setItem('perfume-business-updated', String(Date.now())); } catch { /* Same-tab updates still work if storage is unavailable. */ }
    return saved;
  };
  return <Context.Provider value={{ business, loading, error, refresh, save }}>{children}</Context.Provider>;
}
