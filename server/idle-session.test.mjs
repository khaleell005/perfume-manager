import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_TIMEOUT_MS, watchIdleSession } from '../shared/idle-session.mjs';
function fixture() {
  let time = 1000000, next = 0;
  const timers = new Map(), data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const schedule = (callback, delay) => { const id = ++next; timers.set(id, { at: time + delay, callback }); return id; };
  const cancel = id => timers.delete(id);
  const advance = ms => {
    const end = time + ms;
    while (true) {
      const entry = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      timers.delete(entry[0]); time = entry[1].at; entry[1].callback();
    }
    time = end;
  };
  const start = (options = {}) => {
    const target = new EventTarget(), document = new EventTarget(); document.visibilityState = 'visible'; let expired = 0;
    const stop = watchIdleSession({ storage, key: 'user', target, document, now: () => time, schedule, cancel, onExpire: () => expired++, ...options });
    return { target, document, stop, expired: () => expired };
  };
  return { start, storage, advance, sleep: ms => { time += ms; }, now: () => time };
}

test('idle session expires at five minutes, once, and removes activity listeners', () => {
  const f = fixture(), tab = f.start();
  f.advance(IDLE_TIMEOUT_MS - 1); assert.equal(tab.expired(), 0);
  f.advance(1); assert.equal(tab.expired(), 1);
  tab.target.dispatchEvent(new Event('pointerdown')); f.advance(IDLE_TIMEOUT_MS); assert.equal(tab.expired(), 1);
});
test('typing, pointer and scroll activity postpone logout without background requests resetting it', () => {
  const f = fixture(), tab = f.start();
  for (const type of ['pointermove', 'keydown', 'scroll']) {
    f.advance(240000); tab.target.dispatchEvent(new Event(type)); assert.equal(tab.expired(), 0);
  }
  f.advance(299999); assert.equal(tab.expired(), 0);
  f.advance(1); assert.equal(tab.expired(), 1);
});
test('refreshing a page does not restart the inactivity clock', () => {
  const f = fixture(), first = f.start();
  f.advance(240000); first.stop();
  const reloaded = f.start(); f.advance(59999); assert.equal(reloaded.expired(), 0);
  f.advance(1); assert.equal(reloaded.expired(), 1);
});
test('focus, page restoration and user input cannot revive a session after suspended timers', () => {
  for (const type of ['focus', 'pageshow', 'pointerdown', 'keydown']) {
    const f = fixture(), tab = f.start(); f.sleep(300001);
    tab.target.dispatchEvent(new Event(type)); assert.equal(tab.expired(), 1, type);
  }
  const f = fixture(), tab = f.start(); tab.document.visibilityState = 'hidden';
  f.sleep(300001); tab.target.dispatchEvent(new Event('scroll')); assert.equal(tab.expired(), 0);
  tab.document.visibilityState = 'visible'; tab.document.dispatchEvent(new Event('visibilitychange')); assert.equal(tab.expired(), 1);
});
test('activity in another tab keeps the shared session active; opening a tab does not reset it', () => {
  const f = fixture(), a = f.start(); f.advance(240000); const b = f.start();
  a.target.dispatchEvent(new Event('pointerdown')); f.advance(299999);
  assert.equal(a.expired(), 0); assert.equal(b.expired(), 0);
  f.advance(1); assert.equal(a.expired(), 1); assert.equal(b.expired(), 1);
});
test('an already-expired stored session is rejected immediately on restore', () => {
  const f = fixture(); f.storage.setItem('user', String(f.now() - IDLE_TIMEOUT_MS));
  const tab = f.start(); assert.equal(tab.expired(), 1);
});
test('inactivity still expires when browser storage is unavailable', () => {
  const f = fixture(), tab = f.start({ storage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } });
  f.advance(IDLE_TIMEOUT_MS); assert.equal(tab.expired(), 1);
});
