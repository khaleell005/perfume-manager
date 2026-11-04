export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export function isIdleExpired(lastActivity, now, timeout = IDLE_TIMEOUT_MS) {
  return Number.isFinite(lastActivity) && now - lastActivity >= timeout;
}

// Check elapsed wall-clock time on wake as well as on timers: background tabs
// can suspend timers. A shared activity timestamp keeps other tabs in sync.
export function watchIdleSession({ storage, key, target, document, onExpire, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout, timeout = IDLE_TIMEOUT_MS }) {
  const read = () => {
    try { const value = storage.getItem(key); return value === null ? null : Number(value); }
    catch { return null; }
  };
  let lastActivity = read();
  const fresh = !Number.isFinite(lastActivity) || lastActivity > now();
  if (fresh) lastActivity = now();
  let lastWritten = -Infinity, timer, stopped = false;
  const persist = () => {
    try { storage.setItem(key, String(lastActivity)); lastWritten = now(); } catch { /* In-memory timing still works. */ }
  };
  const latest = () => {
    const stored = read();
    if (Number.isFinite(stored) && stored <= now()) lastActivity = Math.max(lastActivity, stored);
    return lastActivity;
  };
  const expire = () => {
    if (stopped) return;
    stop();
    onExpire();
  };
  const check = () => {
    if (stopped) return;
    cancel(timer);
    if (isIdleExpired(latest(), now(), timeout)) expire();
    else timer = schedule(check, Math.max(1, timeout - (now() - lastActivity)));
  };
  const activity = () => {
    if (stopped || document.visibilityState === 'hidden') return;
    // Returning to an expired session must never revive it.
    if (isIdleExpired(latest(), now(), timeout)) { expire(); return; }
    lastActivity = now();
    if (now() - lastWritten >= 1000) persist();
  };
  const visible = () => { if (document.visibilityState === 'visible') check(); };
  const stored = event => { if (event.key === key || event.key === null) check(); };
  const interactions = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel', 'scroll'];
  function stop() {
    if (stopped) return;
    stopped = true; cancel(timer);
    for (const event of interactions) target.removeEventListener(event, activity, true);
    target.removeEventListener('focus', check);
    target.removeEventListener('pageshow', check);
    target.removeEventListener('storage', stored);
    document.removeEventListener('visibilitychange', visible);
  }
  for (const event of interactions) target.addEventListener(event, activity, { capture: true, passive: true });
  target.addEventListener('focus', check);
  target.addEventListener('pageshow', check);
  target.addEventListener('storage', stored);
  document.addEventListener('visibilitychange', visible);
  if (fresh) persist();
  check();
  return stop;
}
