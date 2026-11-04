import { useSyncExternalStore } from 'react';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const listeners = new Set<() => void>();
const displayMode = window.matchMedia('(display-mode: standalone)');
let state = {
  prompt: null as InstallPrompt | null,
  installed: displayMode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone,
  online: navigator.onLine,
};
const update = (next: Partial<typeof state>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };
window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); update({ prompt: event as InstallPrompt }); });
window.addEventListener('appinstalled', () => update({ prompt: null, installed: true }));
displayMode.addEventListener('change', () => update({ installed: displayMode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone }));
window.addEventListener('online', () => update({ online: true }));
window.addEventListener('offline', () => update({ online: false }));
export function usePwa() {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
  return { ...snapshot, install: async () => {
    if (!state.prompt) return;
    const prompt = state.prompt;
    update({ prompt: null });
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') update({ installed: true });
  } };
}
