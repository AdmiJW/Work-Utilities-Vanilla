import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from './session-repository.js';
import { createWorkspaceBackup } from '../functions/workspace-backup.js';

const repositories = [];
const summary = {
  id: 'one',
  toolId: 'sql-formatter',
  name: 'One',
  createdAt: 1,
  updatedAt: 2,
  isOpen: false,
};
const document = {
  id: 'one',
  schemaVersion: 1,
  source: 'SELECT 0001;\r\n',
  revision: 0,
  options: { wordWrap: true },
};
const workspace = {
  order: [],
  activeId: null,
  counters: { 'sql-formatter': 1, 'output-analyzer': 0 },
};
async function repository() {
  const value = new SessionRepository(`test-${crypto.randomUUID()}`);
  repositories.push(value);
  await value.initialize();
  return value;
}
afterEach(async () => {
  for (const item of repositories.splice(0)) await item.database.delete();
});

describe('IndexedDB sessions', () => {
  it('persists exact documents and metadata-only access, preserving timestamps against stale autosaves', async () => {
    const value = await repository();
    await value.save(summary, document);
    const writes = vi.spyOn(IDBObjectStore.prototype, 'put');
    await value.recordAccess('one', 100);
    expect(
      writes.mock.contexts.some(
        (context) => context instanceof IDBObjectStore && context.name === 'documents',
      ),
    ).toBe(false);
    writes.mockRestore();
    expect(await value.read('one')).toEqual(document);
    expect((await value.list())[0]).toMatchObject({ updatedAt: 2, lastViewedAt: 100 });
    await value.save(summary, { ...document, source: 'new' });
    await value.recordAccess('one', 50);
    expect((await value.list())[0].lastViewedAt).toBe(100);
    await value.commitLifecycle([summary], workspace, false);
    expect((await value.list())[0]).toMatchObject({ isOpen: false, lastViewedAt: 100 });
    await value.commitLifecycle([summary], workspace, true);
    await value.recordAccess('one', 200);
    expect(await value.list()).toEqual([]);
  });
  it('rolls back lifecycle changes and workspace replacement atomically on storage failure', async () => {
    const value = await repository();
    await value.save(summary, document);
    await expect(
      value.commitLifecycle([summary], { ...workspace, bad: () => {} }, true),
    ).rejects.toThrow();
    expect(await value.read('one')).toEqual(document);
    const backup = createWorkspaceBackup(
      [{ ...summary, id: 'two' }],
      [{ ...document, id: 'two', options: { bad: () => {} } }],
      workspace,
      { theme: 'light', collapsed: false },
    );
    await expect(value.replaceWorkspace(backup)).rejects.toThrow();
    expect(await value.read('one')).toEqual(document);
    expect((await value.list())[0].id).toBe('one');
  });
  it('keeps a usable in-memory repository when browser storage is denied', async () => {
    const value = new SessionRepository(`test-${crypto.randomUUID()}`);
    repositories.push(value);
    vi.spyOn(value.database, 'open').mockRejectedValueOnce(new Error('denied'));
    await value.initialize();
    expect(value.persistent).toBe(false);
    await value.save(summary, document);
    expect(await value.read('one')).toEqual(document);
    await value.recordAccess('one', 10);
    expect((await value.list())[0].lastViewedAt).toBe(10);
    expect(value.storageError).toContain('memory only');
  });
});
