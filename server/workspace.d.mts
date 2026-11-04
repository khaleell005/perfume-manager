export type WorkspaceRecord = Record<string, unknown> & { id: string };
export const workspaceCollections: string[];
export function createWorkspaceStore(adapter: {
  get(collection: string, id: string): WorkspaceRecord | null;
  list(collection: string): WorkspaceRecord[];
  put(collection: string, id: string, data: Record<string, unknown>): WorkspaceRecord;
  remove(collection: string, id: string): void;
}): Record<string, (...args: unknown[]) => unknown>;
