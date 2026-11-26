import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../adapters/session-repository.js';
import { WorkspaceRepository } from '../adapters/workspace-repository.js';
import { SessionState } from './session-state.js';
import { WorkspacePersistence } from './workspace-persistence.js';
import { WorkspaceBackups } from './workspace-backups.js';

const workspaces = [];
async function workspace() {
  const browser = new SessionRepository(`files-${crypto.randomUUID()}`);
  const repository = new WorkspaceRepository(browser),
    state = new SessionState(repository);
  const persistence = new WorkspacePersistence(state, repository);
  await state.initialize();
  workspaces.push({ state, browser, persistence });
  return { state, browser, repository, persistence };
}
function fileHandle(text = '') {
  const value = { text, writes: 0, active: 0, maximum: 0, allowed: true };
  value.handle = {
    name: 'workspace.json',
    queryPermission: async () => (value.allowed ? 'granted' : 'denied'),
    requestPermission: async () => (value.allowed ? 'granted' : 'denied'),
    getFile: async () => new Blob([value.text]),
    createWritable: async () => {
      value.active++;
      value.maximum = Math.max(value.maximum, value.active);
      let next;
      return {
        write: async (text) => {
          next = text;
        },
        close: async () => {
          if (value.hold) {
            const hold = value.hold;
            value.hold = null;
            hold.enter();
            await hold.wait;
          }
          if (value.fail) {
            value.fail = false;
            throw new Error('Disk denied');
          }
          value.text = next;
          value.writes++;
          value.active--;
        },
        abort: async () => {
          value.active--;
        },
      };
    },
  };
  return value;
}
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const { state, browser, persistence } of workspaces.splice(0)) {
    persistence.dispose();
    state.autosave.dispose();
    await state.preferenceQueue;
    await browser.database.delete();
  }
});

describe('workspace file persistence', () => {
  it('commits new folder placements with their Browser documents and preserves placement through retries', async () => {
    const { state, browser, repository } = await workspace();
    const outside = await state.create('sql-formatter', 'Existing', 'SELECT 1;');
    const draft = await state.create('diff-checker');
    await state.library.saveFolder(null, 'Projects');
    const [project] = state.library.tree.folders;
    await state.library.saveFolder(project.id, 'Notes');
    const [, notes] = state.library.tree.folders;
    expect(await state.library.setDestination(notes.id)).toBe(true);
    state.updateDiffText(draft, '', 'only on the right');
    expect(state.library.tree.placements).toEqual({ [draft]: notes.id });

    expect(await state.library.setDestination(project.id)).toBe(true);
    const other = await state.create('json-formatter');
    state.updateSource(other, '{}');
    vi.spyOn(browser.documents, 'put').mockRejectedValueOnce(new Error('Browser write failed'));
    expect(await state.autosave.flush(draft)).toBe(false);
    expect(await browser.read(draft)).toBeUndefined();
    const before = await browser.getPreference('workspace');
    expect(before.library.placements).toEqual({});
    expect(before.order).toEqual([outside]);

    state.updateSource(outside, 'SELECT 2;');
    await state.activate(draft);
    const saves = await Promise.all([
      state.autosave.flush(draft),
      state.autosave.flush(other),
      state.autosave.flush(outside),
      state.library.saveFolder(project.id, 'Renamed', notes.id),
    ]);
    expect(saves).toEqual([true, true, true, true]);
    const reloaded = new SessionState(repository);
    await reloaded.initialize();
    await reloaded.preferenceQueue;
    expect(reloaded.library.destinationId).toBe(project.id);
    expect(reloaded.library.tree.placements).toEqual({ [draft]: notes.id, [other]: project.id });
    expect(reloaded.library.folder(notes.id).name).toBe('Renamed');
    expect((await browser.read(draft)).options.rightText).toBe('only on the right');
    expect((await browser.read(outside)).source).toBe('SELECT 2;');
  });

  it('carries the file save destination through retry, backup and restore and resets it on deletion', async () => {
    const { state, persistence } = await workspace();
    const file = fileHandle();
    expect(await persistence.switches.saveAs(file.handle)).toBe(true);
    expect(await state.library.saveFolder(null, 'Work')).toBe(true);
    const [folder] = state.library.tree.folders;
    expect(await state.library.setDestination(folder.id)).toBe(true);
    const id = await state.create('json-formatter');
    state.updateOptions(id, { indentWidth: 6 });
    state.updateSource(id, '{"test":true}');
    file.fail = true;
    expect(await persistence.flush()).toBe(false);
    expect(JSON.parse(file.text).documents).toEqual([]);
    expect(state.library.tree.placements[id]).toBe(folder.id);
    expect(await persistence.flush()).toBe(true);
    const backups = new WorkspaceBackups(state);
    const backup = await backups.export();
    expect(backup.workspace.newSessionFolderId).toBe(folder.id);
    expect(backup.workspace.library.placements).toEqual({ [id]: folder.id });
    expect(await persistence.switches.reload(() => true)).toBe(true);
    expect(state.library.destinationId).toBe(folder.id);
    expect(state.document(id).options.indentWidth).toBe(6);

    expect(await state.library.deleteFolder(folder.id)).toBe(true);
    expect(state.library.destinationId).toBeNull();
    expect(JSON.parse(file.text).workspace).not.toHaveProperty('newSessionFolderId');
    expect(await backups.restore(backup)).toBe(true);
    expect(state.library.destinationId).toBe(folder.id);
    expect(state.library.tree.placements).toEqual({ [id]: folder.id });
  });

  it('commits folder transfers and recursive deletes while leaving temporary tabs out of files', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Evidence', '# One');
    const other = await state.create('sql-formatter', 'Outside folder', 'SELECT 1;');
    await state.activate(id);
    const draft = await state.create('sql-formatter');
    const file = fileHandle();
    expect(await persistence.switches.saveAs(file.handle)).toBe(true);
    const original = JSON.parse(file.text);
    expect(original.schemaVersion).toBe(2);
    expect(original.workspace.order).toEqual([id, other]);
    expect(state.activeId).toBe(draft);
    expect(await state.library.saveFolder(null, 'Project')).toBe(true);
    const [project] = state.library.tree.folders;
    expect(await state.library.saveFolder(project.id, 'Evidence')).toBe(true);
    const [, evidence] = state.library.tree.folders;
    expect(await state.library.saveFolder(project.id, 'evidence')).toBe(false);
    expect(await state.library.move({ folderId: project.id }, evidence.id)).toBe(false);
    expect(await state.library.saveFolder(project.id, 'Notes', evidence.id)).toBe(true);
    expect(await state.library.move({ ids: [id] }, evidence.id)).toBe(true);
    const organized = JSON.parse(file.text);
    expect(organized.schemaVersion).toBe(3);
    expect(organized.workspace.library.placements).toEqual({ [id]: evidence.id });
    expect(organized.workspace.library.folders[1]).toMatchObject({
      name: 'Notes',
      parentId: project.id,
    });
    expect(await persistence.switches.reload(() => true)).toBe(true);
    expect(state.order).toEqual([id, other]);
    expect(state.library.tree).toEqual(organized.workspace.library);
    state.updateSource(id, '# Keep through failure');
    state.updateSource(other, 'SELECT 2;');
    file.fail = true;
    expect(await state.library.deleteFolder(project.id)).toBe(false);
    expect(state.order).toEqual([id, other]);
    expect(state.document(id).source).toBe('# Keep through failure');
    expect(state.library.tree).toEqual(organized.workspace.library);
    expect(JSON.parse(file.text)).toEqual(organized);
    expect(await state.library.deleteFolder(project.id)).toBe(true);
    const remaining = JSON.parse(file.text);
    expect(remaining.schemaVersion).toBe(2);
    expect(remaining.documents.map(({ source }) => source)).toEqual(['SELECT 2;']);
    expect(remaining.workspace.order).toEqual([other]);
  });

  it('opens a picked file directly after saving the Browser workspace and retains work on failure', async () => {
    const target = await workspace();
    await target.state.create('markdown-editor', 'From file', 'on disk');
    const file = fileHandle();
    await target.persistence.switches.saveAs(file.handle);

    const { state, persistence, browser } = await workspace();
    const id = await state.create('markdown-editor', 'Browser note', 'saved');
    state.updateSource(id, 'unsaved edit');
    state.setAppearance({ theme: 'dark' });
    const open = () => persistence.switches.chooseOpen(undefined, { preserveBrowser: true });

    vi.stubGlobal('showOpenFilePicker', async () => {
      throw new DOMException('Cancelled', 'AbortError');
    });
    expect(await open()).toBe(false);
    vi.stubGlobal('showOpenFilePicker', async () => [fileHandle('invalid file').handle]);
    expect(await open()).toBe(false);
    vi.stubGlobal('showOpenFilePicker', async () => [file.handle]);
    vi.spyOn(browser, 'save').mockRejectedValueOnce(new Error('Browser write failed'));
    expect(await open()).toBe(false);
    expect(state.error).toBe('Browser write failed');
    expect(state.document(id).source).toBe('unsaved edit');
    expect(persistence.mode).toBe('browser');

    expect(await open()).toBe(true);
    expect(persistence.mode).toBe('file');
    expect(state.activeSession.name).toBe('From file');
    expect((await browser.read(id)).source).toBe('unsaved edit');
    expect((await browser.getPreference('appearance')).theme).toBe('dark');
    expect(file.writes).toBe(1);
  });

  it('protects memory-only sessions and opens an existing file from an empty memory workspace', async () => {
    const target = await workspace();
    await target.state.create('markdown-editor', 'From file', 'on disk');
    const file = fileHandle();
    await target.persistence.switches.saveAs(file.handle);
    const { state, persistence, browser } = await workspace();
    browser.persistent = false;
    const id = await state.create('markdown-editor', 'Draft', 'in memory');
    const open = () => persistence.switches.open(file.handle, undefined, { preserveBrowser: true });
    expect(await open()).toBe(false);
    expect(state.error).toContain('Use Create from current workspace or Export Backup');
    expect(state.document(id).source).toBe('in memory');
    expect(persistence.mode).toBe('browser');
    expect(await state.deleteMany([id])).toBe(true);

    expect(await open()).toBe(true);
    expect(state.activeSession.name).toBe('From file');
  });

  it('imports legacy backups into the active file as v2 and preserves current data after failed replacement', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'original');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    const legacy = JSON.parse(file.text);
    legacy.schemaVersion = 1;
    delete legacy.images;
    legacy.documents[0].source = 'legacy import';
    const backups = new WorkspaceBackups(state);
    expect(await backups.restore(legacy)).toBe(true);
    expect(JSON.parse(file.text).schemaVersion).toBe(2);
    expect(state.document(id).source).toBe('legacy import');
    const previous = file.text;
    const replacement = JSON.parse(previous);
    replacement.documents[0].source = 'replacement';
    file.fail = true;
    expect(await backups.restore(replacement)).toBe(false);
    expect(file.text).toBe(previous);
    expect(state.document(id).source).toBe('legacy import');
    expect(state.busy).toBe(false);
  });
  it('waits for old Browser preference writes before adopting the file backend', async () => {
    const { state, persistence, browser, repository } = await workspace();
    await state.create('markdown-editor', 'Note', 'one');
    await state.preferenceQueue;
    let enter, release;
    const entered = new Promise((resolve) => {
      enter = resolve;
    });
    const wait = new Promise((resolve) => {
      release = resolve;
    });
    const original = browser.setPreference.bind(browser);
    vi.spyOn(browser, 'setPreference').mockImplementationOnce(async (...args) => {
      enter();
      await wait;
      return original(...args);
    });
    state.setAppearance({ theme: 'dark' });
    await entered;
    const file = fileHandle(),
      switching = persistence.switches.saveAs(file.handle);
    await Promise.resolve();
    expect(persistence.mode).toBe('browser');
    release();
    expect(await switching).toBe(true);
    expect((await repository.getPreference('appearance')).theme).toBe('dark');
    expect(JSON.parse(file.text).appearance.theme).toBe('dark');
    expect(repository.pending.size).toBe(0);
  });

  it('rolls back a failed lifecycle file commit before removing live tabs or staged images', async () => {
    const { state, persistence, repository } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'keep');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    file.fail = true;
    expect(await state.close(id)).toBe(false);
    expect(state.activeId).toBe(id);
    expect((await repository.list())[0].isOpen).toBe(true);
    expect(state.document(id).source).toBe('keep');
    expect(await state.close(id)).toBe(true);
    expect(JSON.parse(file.text).summaries[0].isOpen).toBe(false);
  });
  it('keeps original screenshot bytes through pending saves, closure and subsequent edits', async () => {
    const { state, persistence } = await workspace();
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTHcAAAAASUVORK5CYII=';
    const id = await state.create('sql-formatter', 'Evidence', 'SELECT 1;');
    state.images.add(id, [
      {
        blob: new Blob([Buffer.from(png, 'base64')], { type: 'image/png' }),
        type: 'image/png',
        width: 1,
        height: 1,
        name: 'proof.png',
      },
    ]);
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    expect(JSON.parse(file.text).images[0].data).toBe(png);
    expect(await state.close(id)).toBe(true);
    expect(state.images.cache.size).toBe(0);
    expect(await state.activate(id)).toBe(true);
    state.updateSource(id, 'SELECT 2;');
    expect(await persistence.flush()).toBe(true);
    expect(JSON.parse(file.text).images[0].data).toBe(png);
    const image = await state.images.read(state.document(id).unitTestImages[0].id);
    expect(Buffer.from(await image.blob.arrayBuffer()).toString('base64')).toBe(png);
  });

  it('preserves the Browser workspace after picker cancellation, denied permission or failed initial write', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Keep', 'keep');
    vi.stubGlobal('showSaveFilePicker', async () => {
      throw new DOMException('Cancelled', 'AbortError');
    });
    expect(await persistence.switches.create()).toBe(false);
    const denied = fileHandle();
    denied.allowed = false;
    expect(await persistence.switches.saveAs(denied.handle)).toBe(false);
    const broken = fileHandle();
    broken.fail = true;
    expect(await persistence.switches.saveAs(broken.handle)).toBe(false);
    expect(persistence.mode).toBe('browser');
    expect(state.document(id).source).toBe('keep');
    expect(broken.text).toBe('');
  });

  it('recovers failed file edits through Save As while preserving the original file', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'one');
    const original = fileHandle();
    await persistence.switches.saveAs(original.handle);
    const before = original.text;
    state.updateSource(id, 'recover this');
    original.allowed = false;
    expect(await persistence.flush()).toBe(false);
    const recovery = fileHandle();
    expect(await persistence.switches.saveAs(recovery.handle)).toBe(true);
    expect(original.text).toBe(before);
    expect(persistence.handle).toBe(recovery.handle);
    expect(JSON.parse(recovery.text).documents[0].source).toBe('recover this');
  });
  it('allows explicit Browser recovery when the file destination is unavailable', async () => {
    const { state, persistence, browser } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'one');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    state.updateSource(id, 'recover into browser');
    file.allowed = false;
    expect(await persistence.flush()).toBe(false);
    expect(await persistence.switches.browser(async () => true)).toBe(true);
    expect((await browser.read(id)).source).toBe('recover into browser');
    expect(persistence.mode).toBe('browser');
  });
  it('saves all retained sessions and settings, carries them back to Browser, and leaves handle metadata outside backups', async () => {
    const { state, persistence, browser } = await workspace();
    const closed = await state.create('markdown-editor', 'Closed', '# Original\r\n');
    await state.close(closed);
    const active = await state.create('sql-formatter', 'Active', 'SELECT 001;');
    const file = fileHandle();
    expect(await persistence.switches.saveAs(file.handle)).toBe(true);
    expect(persistence.mode).toBe('file');
    state.updateSource(active, 'SELECT 002;\r\n');
    state.setAppearance({ theme: 'dark', librarySort: 'name' });
    expect((await state.saveActive()).status).toBe('saved');
    const saved = JSON.parse(file.text);
    expect(saved.documents.find((doc) => doc.id === closed).source).toBe('# Original\r\n');
    expect(saved.documents.find((doc) => doc.id === active).source).toBe('SELECT 002;\r\n');
    expect(saved.appearance).toMatchObject({ theme: 'dark', librarySort: 'name' });
    expect(file.text).not.toContain('storageConnections');
    expect((await browser.read(active)).source).toBe('SELECT 001;');
    expect(await persistence.switches.browser(async () => true)).toBe(true);
    expect((await browser.read(active)).source).toBe('SELECT 002;\r\n');
    expect(persistence.mode).toBe('browser');
  });

  it('uses one 10-second delay for document changes and metadata, without a second debounce', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'one');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    vi.useFakeTimers();
    state.updateSource(id, 'two');
    await vi.advanceTimersByTimeAsync(9000);
    expect(file.writes).toBe(1);
    state.setAppearance({ collapsed: true });
    await state.preferenceQueue;
    await vi.advanceTimersByTimeAsync(9999);
    expect(file.writes).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await persistence.flushing;
    expect(file.writes).toBe(2);
    expect(JSON.parse(file.text).documents[0].source).toBe('two');
    expect(persistence.dirty).toBe(false);
  });

  it('serializes saves and does not acknowledge changes arriving during a file write', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'one');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    let enter, release;
    const entered = new Promise((resolve) => {
      enter = resolve;
    });
    file.hold = {
      enter,
      wait: new Promise((resolve) => {
        release = resolve;
      }),
    };
    state.updateSource(id, 'two');
    const first = persistence.flush();
    await entered;
    expect(persistence.status).toBe('saving');
    state.updateSource(id, 'three');
    const second = persistence.flush();
    release();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(JSON.parse(file.text).documents[0].source).toBe('three');
    expect(file.maximum).toBe(1);
    expect(persistence.dirty).toBe(false);
  });

  it('preserves failed writes, exports live drafts, retries and detects external changes before overwrite', async () => {
    const { state, persistence } = await workspace();
    const id = await state.create('markdown-editor', 'Note', 'one');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    const original = file.text;
    state.updateSource(id, 'draft');
    file.fail = true;
    expect(await persistence.flush()).toBe(false);
    expect(file.text).toBe(original);
    expect(persistence.dirty).toBe(true);
    expect((await new WorkspaceBackups(state).export()).documents[0].source).toBe('draft');
    state.updateSource(id, 'newer');
    const external = JSON.parse(file.text);
    external.documents[0].source = 'external';
    file.text = JSON.stringify(external);
    expect(await persistence.flush()).toBe(false);
    expect(persistence.conflict).toBe(true);
    expect(JSON.parse(file.text).documents[0].source).toBe('external');
    expect(await persistence.overwrite()).toBe(true);
    expect(JSON.parse(file.text).documents[0].source).toBe('newer');
  });

  it('keeps current data after invalid files, cancelled replacement and failed Browser replacement', async () => {
    const { state, persistence, browser } = await workspace();
    const id = await state.create('markdown-editor', 'Keep', 'keep');
    expect(await persistence.switches.open(fileHandle('not JSON').handle)).toBe(false);
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    const other = JSON.parse(file.text);
    other.documents[0].source = 'other';
    expect(
      await persistence.switches.open(fileHandle(JSON.stringify(other)).handle, async () => false),
    ).toBe(false);
    expect(state.document(id).source).toBe('keep');
    state.updateSource(id, 'new');
    await persistence.flush();
    vi.spyOn(browser, 'replaceWorkspace').mockRejectedValueOnce(new Error('Quota'));
    expect(await persistence.switches.browser(async () => true)).toBe(false);
    expect(persistence.mode).toBe('file');
    expect(state.document(id).source).toBe('new');
  });

  it('restores remembered handles without writes and gates missing permission without replacing Browser data', async () => {
    const { state, persistence, browser } = await workspace();
    await state.create('markdown-editor', 'Keep', 'original');
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    // Browser structured cloning of native handles is covered in browser tests.
    vi.spyOn(browser, 'getConnection').mockResolvedValue({ mode: 'file', handle: file.handle });
    const repository = new WorkspaceRepository(browser),
      restored = new SessionState(repository);
    const connection = new WorkspacePersistence(restored, repository);
    await restored.initialize();
    expect(restored.activeSession.name).toBe('Keep');
    expect(connection.dirty).toBe(false);
    expect(file.writes).toBe(1);
    connection.dispose();
    restored.autosave.dispose();
    file.allowed = false;
    const deniedRepo = new WorkspaceRepository(browser),
      denied = new SessionState(deniedRepo);
    const blocked = new WorkspacePersistence(denied, deniedRepo);
    await denied.initialize();
    expect(blocked.needsReconnect).toBe(true);
    expect(denied.summaries).toEqual([]);
    expect(await blocked.switches.browser(async () => true)).toBe(true);
    expect(denied.activeSession.name).toBe('Keep');
    blocked.dispose();
    denied.autosave.dispose();
  });

  it('saves an empty workspace with Ctrl+S and retains tabs after a failed close', async () => {
    const { state, persistence } = await workspace();
    const file = fileHandle();
    await persistence.switches.saveAs(file.handle);
    state.setAppearance({ theme: 'dark' });
    expect((await state.saveActive()).status).toBe('saved');
    const id = await state.create('markdown-editor', 'Note', 'keep');
    state.updateSource(id, 'pending');
    file.fail = true;
    expect(await state.close(id)).toBe(false);
    expect(state.activeId).toBe(id);
    expect(state.document(id).source).toBe('pending');
    expect(await state.close(id)).toBe(true);
    expect(JSON.parse(file.text).summaries[0].isOpen).toBe(false);
  });
});
