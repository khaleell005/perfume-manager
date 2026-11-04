import { useSyncExternalStore } from 'react';
import { Icon } from './ui';

export type ThemePreference = 'light' | 'dark' | 'system';
const key = 'perfume-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();
let preference: ThemePreference = 'system';
try { const saved = localStorage.getItem(key); if (saved === 'light' || saved === 'dark') preference = saved; } catch { /* Browser storage may be unavailable. */ }
const resolvedTheme = () => preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b171e' : '#f8f7f4');
  listeners.forEach(listener => listener());
}
export function setThemePreference(next: ThemePreference) {
  preference = next;
  try { localStorage.setItem(key, next); } catch { /* Keep the preference for this session. */ }
  applyTheme();
}
media.addEventListener('change', applyTheme);
window.addEventListener('storage', (event) => {
  if (event.key === key || event.key === null) {
    preference = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system';
    applyTheme();
  }
});
applyTheme();
export function useTheme() {
  const snapshot = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => `${preference}:${resolvedTheme()}`,
  );
  const [selected, resolved] = snapshot.split(':') as [ThemePreference, 'light' | 'dark'];
  return { preference: selected, resolved, setPreference: setThemePreference };
}
export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const label = `Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`;
  return <button className="icon-button theme-toggle" type="button" onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')} aria-label={label} title={label}><Icon name={resolved === 'dark' ? 'sun' : 'moon'} /></button>;
}
export function ThemeSettings() {
  const { preference, setPreference } = useTheme();
  return <fieldset className="theme-options"><legend className="sr-only">Color theme</legend>{(['light', 'dark', 'system'] as const).map(option => <label className={`theme-option ${preference === option ? 'theme-selected' : ''}`} key={option}><input type="radio" name="color-theme" value={option} checked={preference === option} onChange={() => setPreference(option)} /><Icon name={option === 'light' ? 'sun' : option === 'dark' ? 'moon' : 'monitor'} /><span>{option === 'system' ? 'Use device setting' : `${option[0].toUpperCase()}${option.slice(1)} mode`}</span></label>)}</fieldset>;
}
