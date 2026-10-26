import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository.js';
import { SessionState } from './session-state.js';
import { WorkspaceBackups } from './workspace-backups.js';

const values = [];
async function workspace() {
  const repository = new SessionRepository(`test-${crypto.randomUUID()}`);
  const state = new SessionState(repository);
  await state.initialize();
  values.push({ repository, state });
  return { repository, state, backups: new WorkspaceBackups(state) };
}
afterEach(async () => {
  for (const { state, repository } of values.splice(0)) {
    state.autosave.dispose();
    await repository.database.delete();
  }
});

describe('workspace backup operations', () => {
  it('restores retained sessions, empty sessions, IDs, order, source, preferences and the initially active tab', async () => {
    const { state, backups } = await workspace();
    const first = await state.create('sql-formatter', 'First', 'SELECT 0001;\r\n');
    state.updateOptions(first, { wordWrap: true });
    await state.close(first);
    const empty = await state.create('sql-formatter');
    const active = await state.create('output-analyzer', 'Result', 'original output');
    state.updateOptions(active, { jsonDecodeMode: 'deep' });
    state.setAppearance({ theme: 'dark', collapsed: true, librarySort: 'name' });
    const backup = await backups.export();
    const extra = await state.create('sql-formatter', 'Discard me', 'discard');
    expect(await backups.restore(backup)).toBe(true);
    expect(state.summaries.map((item) => item.id)).toEqual([first, empty, active]);
    expect(state.summaries.some((item) => item.id === extra)).toBe(false);
    expect(state.activeId).toBe(active);
    expect(state.order).toEqual([empty, active]);
    expect(state.document(first).source).toBe('SELECT 0001;\r\n');
    expect(state.document(empty).source).toBe('');
    expect(state.document(active).options.jsonDecodeMode).toBe('deep');
    expect(state.appearance).toEqual({ theme: 'dark', collapsed: true, librarySort: 'name' });
  });
  it('keeps the current workspace and pending data if restoration fails', async () => {
    const { state, repository, backups } = await workspace();
    const id = await state.create('sql-formatter', 'Original', 'keep me');
    const backup = await backups.export();
    state.updateSource(id, 'newer draft');
    vi.spyOn(repository, 'replaceWorkspace').mockRejectedValueOnce(new Error('Storage denied'));
    expect(await backups.restore(backup)).toBe(false);
    expect(state.document(id).source).toBe('newer draft');
    expect(state.activeId).toBe(id);
    expect(state.error).toBe('Storage denied');
    expect(state.busy).toBe(false);
    expect((await repository.read(id)).source).toBe('newer draft');
  });
  it('exports recoverable in-memory source even when autosaving fails', async () => {
    const { state, repository, backups } = await workspace();
    const id = await state.create('sql-formatter');
    state.updateSource(id, 'recover this draft');
    vi.spyOn(repository, 'save').mockRejectedValueOnce(new Error('quota'));
    const backup = await backups.export();
    expect(backup.documents[0].source).toBe('recover this draft');
    expect(state.autosave.status).toBe('error');
    expect(state.busy).toBe(false);
  });
});
