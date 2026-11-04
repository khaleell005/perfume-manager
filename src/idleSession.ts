import { useEffect } from 'react';
import { isIdleExpired, watchIdleSession } from '../shared/idle-session.mjs';
const mode = import.meta.env.MODE === 'production' ? 'firebase' : 'sqlite';
const keyFor = (userId: string) => `perfume-last-activity:${mode}:${userId}`;
const memory = new Map<string, string>();
const storage = {
  getItem(key: string) { try { return localStorage.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
  setItem(key: string, value: string) { memory.set(key, value); try { localStorage.setItem(key, value); } catch { /* Use memory when browser storage is blocked. */ } },
};
export function startActivitySession(userId: string) { storage.setItem(keyFor(userId), String(Date.now())); }
export function sessionIsIdle(userId: string) {
  const value = storage.getItem(keyFor(userId));
  return value !== null && isIdleExpired(Number(value), Date.now());
}
export function useIdleLogout(userId: string | undefined, onExpire: () => void) {
  useEffect(() => {
    if (!userId) return;
    return watchIdleSession({ storage, key: keyFor(userId), target: window, document, onExpire });
  }, [userId, onExpire]);
}
