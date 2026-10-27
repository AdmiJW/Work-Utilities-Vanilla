import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBObjectStore, IDBIndex } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository.js';
import { SessionState } from './session-state.js';
import { WorkspaceBackups } from './workspace-backups.js';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTHcAAAAASUVORK5CYII=';
const screenshot = () => ({
  blob: new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }),
  type: 'image/png',
  width: 1,
  height: 1,
  name: 'evidence.png',
});
const workspaces = [];
async function workspace(memory = false) {
  const repository = new SessionRepository(`images-${crypto.randomUUID()}`);
  if (memory) vi.spyOn(repository.database, 'open').mockRejectedValueOnce(new Error('denied'));
  const state = new SessionState(repository);
  workspaces.push({ state, repository });
  await state.initialize();
  return { state, repository, backups: new WorkspaceBackups(state) };
}
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const { state, repository } of workspaces.splice(0)) {
    state.autosave.dispose();
    await repository.database.delete();
  }
});

describe('filenames and screenshots', () => {
  it('separates tab names, adopts imports until customization, and never advances viewing time', async () => {
    const { state } = await workspace();
    const id = await state.create('sql-formatter', 'Investigation');
    const viewed = state.activeSession.lastViewedAt;
    state.rename(id, 'Renamed tab');
    expect(state.fileName(id)).toBe('Investigation');
    state.setFileName(id, 'first.sql', false);
    expect(state.fileName(id)).toBe('first');
    state.setFileName(id, 'PT-C-DER112233-01.sql');
    state.setFileName(id, 'other.sql', false);
    expect(state.fileName(id)).toBe('PT-C-DER112233-01');
    state.setFileName(id, '   ');
    expect(state.fileName(id)).toBe('PT-C-DER112233-01');
    expect(state.activeSession.lastViewedAt).toBe(viewed);
  });
  it.each([false, true])(
    'restores images and exact v2 backups, including memory-only mode=%s',
    async (memory) => {
      const { state, repository, backups } = await workspace(memory);
      const id = await state.create('sql-formatter', 'Evidence');
      state.images.add(id, [screenshot(), { ...screenshot(), name: 'second.png' }]);
      const refs = state.document(id).unitTestImages;
      state.images.reorder(id, [refs[1].id, refs[0].id]);
      state.updateSource(id, 'SELECT changed;');
      const backup = await backups.export();
      expect(backup.schemaVersion).toBe(2);
      expect(backup.images.map((image) => image.id)).toEqual([refs[1].id, refs[0].id]);
      expect(backup.images[0].data).toBe(png);
      expect(await state.close(id)).toBe(true);
      expect(await state.activate(id)).toBe(true);
      expect((await state.images.read(refs[0].id)).blob.size).toBe(
        Buffer.from(png, 'base64').length,
      );
      state.images.reorder(id, []);
      await state.autosave.flush(id);
      expect(await repository.readImage(refs[0].id)).toBeUndefined();
      expect(await backups.restore(backup)).toBe(true);
      expect(state.document(id).unitTestImages.map((image) => image.id)).toEqual([
        refs[1].id,
        refs[0].id,
      ]);
      expect(await state.deleteMany([id])).toBe(true);
      expect(await repository.readImage(refs[0].id)).toBeUndefined();
    },
  );
  it('does not rewrite screenshot blobs during text autosaves and retains recovery data after failures', async () => {
    const { state, repository, backups } = await workspace();
    const id = await state.create('sql-formatter');
    state.images.add(id, [screenshot()]);
    await state.autosave.flush(id);
    const adds = vi.spyOn(IDBObjectStore.prototype, 'add');
    const payloadReads = vi.spyOn(IDBIndex.prototype, 'getAll');
    state.updateSource(id, 'SELECT updated;');
    await state.autosave.flush(id);
    expect(adds.mock.contexts.some((context) => context.name === 'sessionImages')).toBe(false);
    expect(payloadReads).not.toHaveBeenCalled();
    adds.mockRestore();
    payloadReads.mockRestore();
    state.images.add(id, [screenshot()]);
    vi.spyOn(repository, 'save').mockRejectedValue(new Error('quota exceeded'));
    expect(await state.close(id)).toBe(false);
    const backup = await backups.export();
    expect(backup.images).toHaveLength(2);
    expect(state.autosave.status).toBe('error');
    expect(state.openSessions).toHaveLength(1);
  });
  it('rejects missing or inconsistent backup images before mutating storage and accepts v1', async () => {
    const { state, backups } = await workspace();
    const id = await state.create('sql-formatter', 'Original');
    const legacy = await backups.export();
    legacy.schemaVersion = 1;
    delete legacy.images;
    expect(await backups.restore(legacy)).toBe(true);
    state.images.add(id, [screenshot()]);
    const good = await backups.export();
    for (const modify of [
      (backup) => {
        backup.images = [];
      },
      (backup) => {
        backup.images[0].sessionId = 'missing';
      },
      (backup) => {
        backup.documents[0].unitTestImages[0].width = 99;
      },
      (backup) => {
        backup.images[0].data = 'not-base64';
      },
      (backup) => {
        backup.documents[0].options.sheetNames = { bad: 123 };
      },
      (backup) => {
        backup.documents[0].options.tableSearches = [];
      },
    ]) {
      const backup = structuredClone(good);
      modify(backup);
      expect(() => backups.validate(JSON.stringify(backup))).toThrow();
      expect(state.document(id).unitTestImages).toHaveLength(1);
    }
  });
  it('keeps current drafts and images when a backup image cannot be decoded', async () => {
    const { state, backups } = await workspace();
    const id = await state.create('sql-formatter', 'Current');
    state.images.add(id, [screenshot()]);
    const backup = await backups.export();
    state.updateSource(id, 'SELECT keep_current_draft;');
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Invalid image')));
    expect(await backups.restore(backup)).toBe(false);
    expect(state.document(id).source).toBe('SELECT keep_current_draft;');
    expect(state.document(id).unitTestImages).toHaveLength(1);
    expect(state.busy).toBe(false);
  });
  it('preserves pending text and new screenshots after a failed deletion followed by closing', async () => {
    const { state, repository } = await workspace();
    const id = await state.create('sql-formatter', 'Keep my evidence');
    state.updateSource(id, 'SELECT unsaved_evidence;');
    state.images.add(id, [screenshot()]);
    const imageId = state.document(id).unitTestImages[0].id;
    vi.spyOn(repository, 'commitLifecycle').mockRejectedValueOnce(new Error('Deletion denied'));
    expect(await state.deleteMany([id])).toBe(false);
    expect(state.autosave.pending.has(id)).toBe(true);
    expect(await state.close(id)).toBe(true);
    expect(await state.activate(id)).toBe(true);
    expect(state.document(id).source).toBe('SELECT unsaved_evidence;');
    expect(state.document(id).unitTestImages[0].id).toBe(imageId);
    expect(await repository.readImage(imageId)).toBeTruthy();
  });
  it('rolls back image deletion with lifecycle transactions and rejects superseded image reads', async () => {
    const { state, repository } = await workspace();
    const id = await state.create('sql-formatter');
    state.images.add(id, [screenshot()]);
    await state.autosave.flush(id);
    const imageId = state.document(id).unitTestImages[0].id;
    await expect(
      repository.commitLifecycle([state.activeSession], { bad: () => {} }, true),
    ).rejects.toThrow();
    expect(await repository.readImage(imageId)).toBeTruthy();
    state.images.cache.clear();
    let finish;
    vi.spyOn(repository, 'readImage').mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = state.images.read(imageId);
    state.generation++;
    finish({ id: imageId, sessionId: id, blob: screenshot().blob });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.images.cache.size).toBe(0);
  });
  it('upgrades the v1 database without losing documents and freezes an unopened legacy filename on rename', async () => {
    const name = `images-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old
      .version(1)
      .stores({ summaries: 'id, toolId, updatedAt', documents: 'id', preferences: 'key' });
    await old.table('summaries').put({
      id: 'legacy',
      name: 'Old name',
      toolId: 'sql-formatter',
      createdAt: 1,
      updatedAt: 2,
      isOpen: false,
    });
    await old
      .table('documents')
      .put({ id: 'legacy', schemaVersion: 1, source: 'SELECT 1;', revision: 0, options: {} });
    old.close();
    const repository = new SessionRepository(name);
    const state = new SessionState(repository);
    workspaces.push({ repository, state });
    await state.initialize();
    state.rename('legacy', 'New tab');
    await state.preferenceQueue;
    await state.load();
    await state.activate('legacy');
    expect(state.fileName('legacy')).toBe('Old name');
    expect(state.document('legacy').source).toBe('SELECT 1;');
    expect(repository.database.verno).toBe(2);
  });
});
