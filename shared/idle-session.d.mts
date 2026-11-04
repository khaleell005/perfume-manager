export const IDLE_TIMEOUT_MS: number;
export function isIdleExpired(lastActivity: number, now: number, timeout?: number): boolean;
export function watchIdleSession(options: {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  key: string;
  target: Window;
  document: Document;
  onExpire: () => void;
  now?: () => number;
  timeout?: number;
}): () => void;
