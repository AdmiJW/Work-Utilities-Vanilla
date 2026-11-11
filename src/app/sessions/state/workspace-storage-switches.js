import { MemoryRepository } from '../adapters/memory-repository.js';
import { permission, readConnection, workspaceFileOptions } from '../adapters/file-connection.js';
import {
  snapshotWorkspace,
  snapshotRepository,
  sameWorkspace,
  validateSnapshot,
} from './workspace-snapshot.js';

export class WorkspaceStorageSwitches {
  constructor(persistence) {
    this.persistence = persistence;
  }
  async run(action, discard = false) {
    const p = this.persistence,
      state = p.state;
    if (state.busy) return false;
    state.busy = true;
    state.cancelNavigation();
    state.notify();
    let completed = false;
    try {
      clearTimeout(p.timer);
      if (p.flushing) await p.flushing;
      if (!discard && p.mode === 'file' && !p.needsReconnect && !(await p.flush()))
        throw new Error(p.error);
      await state.preferenceQueue;
      await p.repository.settled();
      // Browser failures must not prevent recovery of live drafts into a new file.
      await state.autosave.flush(undefined, true);
      p.transitioning = true;
      await p.writeQueue;
      await action();
      completed = true;
      p.needsReconnect = false;
      p.error = '';
      p.conflict = false;
      p.status = 'saved';
      p.savedVersion = ++p.version;
      clearTimeout(p.timer);
      await state.autosave.discard([...state.autosave.pending.keys()]);
      await p.remember();
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        state.fail(error);
      }
      return false;
    } finally {
      p.transitioning = false;
      state.busy = false;
      if (!completed && p.dirty && !p.error && !p.needsReconnect) {
        clearTimeout(p.timer);
        p.timer = setTimeout(() => void p.flush(), 10_000);
      }
      state.notify();
    }
  }
  async create() {
    let handle;
    try {
      handle = await globalThis.showSaveFilePicker({
        ...workspaceFileOptions,
        suggestedName: 'work-utilities-workspace.json',
      });
    } catch (error) {
      if (error.name !== 'AbortError') this.persistence.state.fail(error);
      return false;
    }
    return this.saveAs(handle);
  }
  async saveAs(handle) {
    const p = this.persistence;
    try {
      if (!(await permission(handle, true))) throw new Error('Write permission was not granted.');
    } catch (error) {
      p.state.fail(error);
      return false;
    }
    return this.run(async () => {
      const backup = await snapshotWorkspace(p.state);
      const backend = new MemoryRepository(backup);
      const connection = await readConnection(handle);
      const baseline = await p.write(JSON.stringify(backup, null, 2), handle, connection.baseline);
      p.repository.use(backend, 'file');
      p.handle = handle;
      p.baseline = baseline;
      p.state.error = '';
    }, true);
  }
  async reuse(confirm) {
    const p = this.persistence;
    try {
      if (!(await permission(p.handle, true))) throw new Error('Write permission was not granted.');
      const existing = await validateSnapshot((await readConnection(p.handle)).text);
      const current = await snapshotWorkspace(p.state);
      if (!sameWorkspace(current, existing) && !(await confirm())) return false;
      return this.saveAs(p.handle);
    } catch (error) {
      p.state.fail(error);
      return false;
    }
  }
  async chooseOpen(confirm) {
    let handle;
    try {
      [handle] = await globalThis.showOpenFilePicker({
        ...workspaceFileOptions,
        multiple: false,
      });
      if (!(await permission(handle, true))) throw new Error('Write permission was not granted.');
    } catch (error) {
      if (error.name !== 'AbortError') this.persistence.state.fail(error);
      return false;
    }
    return this.open(handle, confirm);
  }
  async open(handle, confirm = async () => true) {
    const p = this.persistence;
    // Read, decode and confirm before touching the active workspace/backend.
    let backup, connection;
    try {
      connection = await readConnection(handle);
      backup = await validateSnapshot(connection.text);
      const current = await snapshotWorkspace(p.state);
      if (!p.needsReconnect && !sameWorkspace(current, backup) && !(await confirm(backup)))
        return false;
    } catch (error) {
      p.state.fail(error);
      return false;
    }
    return this.run(async () => {
      const latest = await readConnection(handle);
      if (latest.baseline !== connection.baseline)
        throw new Error('The selected file changed while opening. Open it again.');
      const backend = new MemoryRepository(backup);
      p.repository.use(backend, 'file');
      p.handle = handle;
      p.baseline = connection.baseline;
      p.state.adoptWorkspace(backup);
    }, p.needsReconnect);
  }
  async browser(confirm) {
    const p = this.persistence;
    if (p.mode === 'browser') return true;
    return this.run(async () => {
      const existing = await snapshotRepository(p.repository.browser);
      const current = p.needsReconnect ? existing : await snapshotWorkspace(p.state);
      if (!p.needsReconnect && !sameWorkspace(current, existing) && !(await confirm())) {
        const cancelled = new Error('Cancelled');
        cancelled.name = 'AbortError';
        throw cancelled;
      }
      if (!p.needsReconnect) await p.repository.browser.replaceWorkspace(current);
      p.repository.use(p.repository.browser, 'browser');
      p.baseline = undefined;
      p.state.adoptWorkspace(current);
    }, true);
  }
  async reload(confirm) {
    const p = this.persistence;
    if (!(await confirm())) return false;
    const handle = p.handle;
    const before = p.needsReconnect;
    p.needsReconnect = true;
    const result = await this.open(handle);
    if (!result) p.needsReconnect = before;
    p.state.notify();
    return result;
  }
}
