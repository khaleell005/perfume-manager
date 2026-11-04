import type { IncomingMessage, ServerResponse } from 'node:http';
export function createApi(options?: { store?: unknown; secureCookies?: boolean }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<unknown>;
