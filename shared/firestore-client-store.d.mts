import type { WorkspaceRecord } from '../server/workspace.mjs';
export function createFirestoreClientStore(io: {
  get(name: string, id: string): Promise<WorkspaceRecord | null>;
  list(name: string): Promise<WorkspaceRecord[]>;
  transaction<T>(callback: (transaction: {
    get(name: string, id: string): Promise<WorkspaceRecord | null>;
    set(name: string, id: string, value: Record<string, unknown>): void;
    delete(name: string, id: string): void;
  }) => Promise<T>): Promise<T>;
}): Record<string, (...args: any[]) => Promise<any>>;
