import type { IncomingMessage, ServerResponse } from 'node:http';
export function createApi(options?: { store?: any; auth?: any }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<unknown>;
