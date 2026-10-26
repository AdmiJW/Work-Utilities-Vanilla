import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionState } from './session-state.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const states = [];
async function workspace(open = false) {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const summaries = ['a', 'b', 'c'].map((id, index) => ({
    id,
    name: id,
    toolId: 'sql-formatter',
    createdAt: index + 1,
    updatedAt: index + 1,
    isOpen: open,
  }));
  const documents = Object.fromEntries(
    summaries.map(({ id }) => [
      id,
      { id, schemaVersion: 1, source: `SELECT '${id}';`, revision: 0, options: { wordWrap: true } },
    ]),
  );
  const repository = {
    initialize: vi.fn(),
    persistent: true,
    list: vi.fn().mockResolvedValue(summaries),
    getPreference: vi.fn(),
    setPreference: vi.fn().mockResolvedValue(undefined),
    read: vi.fn((id) => Promise.resolve(documents[id])),
    save: vi.fn().mockResolvedValue(undefined),
    saveSummary: vi.fn().mockResolvedValue(undefined),
    recordAccess: vi.fn().mockResolvedValue(undefined),
    commitLifecycle: vi.fn().mockResolvedValue(undefined),
  };
  const state = new SessionState(repository);
  states.push(state);
  await state.initialize();
  return { state, repository, summaries, documents };
}
afterEach(() => {
  for (const state of states.splice(0)) state.autosave.dispose();
  vi.useRealTimers();
});

describe('session state and recency', () => {
  it('persists renaming an unopened restored tab without reading or rewriting its document', async () => {
    const { state, repository } = await workspace(true);
    repository.read.mockClear();
    repository.recordAccess.mockClear();
    state.rename('b', 'Renamed before opening');
    await state.preferenceQueue;
    expect(repository.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', name: 'Renamed before opening' }),
    );
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
    expect(repository.recordAccess).not.toHaveBeenCalled();
  });
  it('uses summaries alone with legacy timestamps and creation fallback', async () => {
    const { state, repository, summaries } = await workspace();
    summaries[0].lastViewedAt = 100;
    summaries[0].updatedAt = 500;
    summaries[1].updatedAt = 200;
    summaries[2].createdAt = 300;
    delete summaries[2].updatedAt;
    expect(state.recentSessions.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(repository.read).not.toHaveBeenCalled();
  });
  it('records viewing separately from editing, autosaving, reordering, closure and already-active clicks', async () => {
    const { state, repository } = await workspace();
    await state.activate('a');
    const viewed = state.activeSession.lastViewedAt;
    expect(state.activeSession.updatedAt).toBe(1);
    expect(repository.save).not.toHaveBeenCalled();
    vi.setSystemTime(20_000);
    state.updateSource('a', 'edited');
    await state.autosave.flush();
    expect(state.activeSession.lastViewedAt).toBe(viewed);
    await state.activate('b');
    const calls = repository.recordAccess.mock.calls.length;
    await state.activate('b');
    state.reorder(['b', 'a']);
    const history = state.recentSessions.map((item) => [item.id, item.lastViewedAt]);
    await state.close('b');
    expect(state.activeId).toBe('a');
    await state.close('a');
    expect(repository.recordAccess).toHaveBeenCalledTimes(calls);
    expect(state.recentSessions.map((item) => [item.id, item.lastViewedAt])).toEqual(history);
    await state.deleteMany(['b']);
    expect(state.recentSessions.some((item) => item.id === 'b')).toBe(false);
  });
  it('records creation and only the initially active restored session', async () => {
    const { state, repository } = await workspace(true);
    expect(repository.recordAccess).toHaveBeenCalledExactlyOnceWith('a', 10_000);
    expect(
      state.summaries.filter((item) => item.lastViewedAt !== undefined).map((item) => item.id),
    ).toEqual(['a']);
    const id = await state.create('output-analyzer');
    expect(state.recentSessions[0].id).toBe(id);
  });
  it('keeps failed reads recoverable and retries the same ID and state', async () => {
    const { state, repository } = await workspace();
    repository.read.mockRejectedValueOnce(new Error('Read failed'));
    expect(await state.activate('a')).toBe(false);
    expect(state.openingError).toBe('Read failed');
    expect(state.summaries[0].lastViewedAt).toBeUndefined();
    expect(await state.activate('a')).toBe(true);
    expect(state.document('a').options.wordWrap).toBe(true);
    expect(state.openingError).toBe('');
  });
  it('deduplicates pending reads and ignores a superseded navigation', async () => {
    const { state, repository, documents } = await workspace();
    const pending = deferred();
    repository.read.mockImplementationOnce(() => pending.promise);
    const first = state.activate('a');
    expect(state.openingId).toBe('a');
    expect(await state.activate('a')).toBe(false);
    await state.activate('b');
    pending.resolve(documents.a);
    expect(await first).toBe(false);
    expect(state.activeId).toBe('b');
    expect(state.summaries[0].lastViewedAt).toBeUndefined();
    expect(repository.read).toHaveBeenCalledTimes(2);
  });
  it('invalidates pending reads after creating or deleting sessions', async () => {
    const { state, repository, documents } = await workspace();
    const first = deferred();
    repository.read.mockImplementationOnce(() => first.promise);
    const opening = state.activate('a');
    const id = await state.create('sql-formatter');
    first.resolve(documents.a);
    expect(await opening).toBe(false);
    expect(state.activeId).toBe(id);
    const second = deferred();
    repository.read.mockImplementationOnce(() => second.promise);
    const deleted = state.activate('c');
    await state.deleteMany(['c']);
    second.resolve(documents.c);
    expect(await deleted).toBe(false);
    expect(state.document('c')).toBeUndefined();
  });
  it('keeps every selected tab open when a batch-close save fails', async () => {
    const { state, repository } = await workspace();
    await state.activate('a');
    await state.activate('b');
    state.updateSource('a', 'recover');
    repository.save.mockRejectedValueOnce(new Error('quota'));
    expect(await state.closeMany(['a', 'b'])).toBe(false);
    expect(state.openSessions.map((item) => item.id)).toEqual(['a', 'b']);
    expect(repository.commitLifecycle).not.toHaveBeenCalled();
    repository.save.mockResolvedValue(undefined);
    expect(await state.closeMany(['a', 'b'])).toBe(true);
  });
  it('drains in-flight writes before deleting so they cannot recreate sessions', async () => {
    const { state, repository } = await workspace();
    await state.activate('a');
    const pending = deferred();
    repository.save.mockImplementationOnce(() => pending.promise);
    state.updateSource('a', 'in flight');
    const flush = state.autosave.flush();
    await Promise.resolve();
    const deletion = state.deleteMany(['a']);
    expect(repository.commitLifecycle).not.toHaveBeenCalled();
    state.updateSource('a', 'blocked during deletion');
    pending.resolve();
    await flush;
    await deletion;
    expect(state.document('a')).toBeUndefined();
    expect(repository.commitLifecycle).toHaveBeenCalledExactlyOnceWith(
      expect.arrayContaining([expect.objectContaining({ id: 'a' })]),
      expect.any(Object),
      true,
    );
  });
});
