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
