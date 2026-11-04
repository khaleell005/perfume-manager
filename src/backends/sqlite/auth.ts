import { request } from './api';
import { startActivitySession } from '../../idleSession';

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
export async function signIn(email: string, password: string) { const session = await request<Session>('/login', 'POST', { email, password }); if (session.user) startActivitySession(session.user.id); return notify(session); }
export async function createOwner(email: string, password: string) { const session = await request<Session>('/setup', 'POST', { email, password }); if (session.user) startActivitySession(session.user.id); return notify(session); }
export async function signOut() { return notify(await request<Session>('/logout', 'POST')); }
export const changePassword = (currentPassword: string, password: string) => request('/password', 'POST', { currentPassword, password });
export async function updateProfileName(name: string) { return notify(await request<Session>('/profile', 'PATCH', { name })); }
