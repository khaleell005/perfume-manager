import { request } from './api';

export interface User { id: string; email: string; displayName: string }
export interface Session { user: User | null; setupRequired: boolean }
const listeners = new Set<(session: Session) => void>();
const notify = (session: Session) => { listeners.forEach(listener => listener(session)); return session; };
export function onSessionChanged(callback: (session: Session) => void, onError: () => void) {
  let active = true;
  listeners.add(callback);
  const refresh = () => request<Session>('/session').then(session => { if (active) callback(session); }).catch(() => { if (active) onError(); });
  void refresh();
  window.addEventListener('online', refresh);
  const expired = () => { if (active) callback({ user: null, setupRequired: false }); };
  window.addEventListener('session-expired', expired);
  return () => { active = false; listeners.delete(callback); window.removeEventListener('online', refresh); window.removeEventListener('session-expired', expired); };
}
export async function signIn(email: string, password: string) { return notify(await request<Session>('/login', 'POST', { email, password })); }
export async function createOwner(email: string, password: string) { return notify(await request<Session>('/setup', 'POST', { email, password })); }
export async function signOut() { return notify(await request<Session>('/logout', 'POST')); }
export const changePassword = (currentPassword: string, password: string) => request('/password', 'POST', { currentPassword, password });
