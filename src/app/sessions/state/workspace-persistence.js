import { MemoryRepository } from '../adapters/memory-repository.js';
import { readConnection, writeConnection, permission } from '../adapters/file-connection.js';
import { snapshotRepository, validateSnapshot } from './workspace-snapshot.js';
import { WorkspaceStorageSwitches } from './workspace-storage-switches.js';

export class WorkspacePersistence {
  constructor(state, repository) {
    this.state = state;
    this.repository = repository;
    state.persistence = this;
    repository.persistence = this;
    this.version = 0;
    this.savedVersion = 0;
    this.status = 'saved';
    this.error = '';
    this.warning = '';
    this.handle = null;
    this.baseline = undefined;
    this.needsReconnect = false;
    this.conflict = false;
    this.writeQueue = Promise.resolve();
    this.switches = new WorkspaceStorageSwitches(this);
  }
  get mode() {
    return this.repository.mode;
  }
  get filename() {
    return this.handle?.name ?? 'workspace file';
  }
  get dirty() {
    return this.mode === 'file' && this.version !== this.savedVersion;
  }
  changed() {
    this.version++;
    clearTimeout(this.timer);
    if (!this.error && !this.needsReconnect) {
      this.status = 'unsaved';
      this.timer = setTimeout(() => void this.flush(), 10_000);
    }
    this.state.notify();
  }
  async drain() {
    this.staging = true;
    try {
      do {
        await this.state.preferenceQueue;
        if (!(await this.state.autosave.flush(undefined, true)))
          throw new Error(this.state.autosave.error);
        await this.repository.settled();
      } while (this.state.autosave.pending.size);
    } finally {
      this.staging = false;
    }
  }
  write(text, handle = this.handle, baseline = null) {
    const task = this.writeQueue.then(async () => {
      const result = await writeConnection(
        handle,
        text,
        baseline === null ? (handle === this.handle ? this.baseline : undefined) : baseline,
      );
      if (handle === this.handle) this.baseline = result;
      return result;
    });
    this.writeQueue = task.catch(() => {});
    return task;
  }
  flush() {
    if (this.mode !== 'file') return this.state.autosave.flush();
    if (this.transitioning) return Promise.resolve(false);
    if (this.needsReconnect || !this.handle) return Promise.resolve(false);
    if (this.flushing) {
      this.flushRequested = true;
      return this.flushing;
    }
    if (!this.dirty && !this.error && !this.state.autosave.pending.size)
      return Promise.resolve(true);
    this.flushRequested = true;
    this.flushing = (async () => {
      while (this.flushRequested) {
        this.flushRequested = false;
        await this.drain();
        clearTimeout(this.timer);
        if (!this.dirty && !this.error) continue;
        const version = this.version,
          epoch = this.repository.epoch;
        this.status = 'saving';
        this.state.notify();
        const backup = await snapshotRepository(this.repository.backend);
        if (epoch !== this.repository.epoch)
          throw new Error('The storage destination changed. Retry saving.');
        await this.write(JSON.stringify(backup, null, 2));
        this.savedVersion = version;
        this.error = '';
        this.conflict = false;
        this.status = this.dirty ? 'unsaved' : 'saved';
      }
      return true;
    })()
      .catch((error) => {
        this.error =
          error.message ||
          'The workspace file could not be saved. Retry, reconnect, or export a backup.';
        this.conflict = error.code === 'FILE_CONFLICT';
        this.status = 'error';
        clearTimeout(this.timer);
        return false;
      })
      .finally(() => {
        this.flushing = null;
        this.state.notify();
      });
    return this.flushing;
  }
  async commitStaged() {
    this.changed();
    if (!(await this.flush()))
      throw new Error(this.error || 'The workspace file could not be saved.');
  }
  async replace(backup) {
    const validated = await validateSnapshot(JSON.stringify(backup));
    if (this.flushing) await this.flushing;
    this.transitioning = true;
    try {
      const backend = new MemoryRepository(validated);
      const normalized = await snapshotRepository(backend);
      const text = JSON.stringify(normalized, null, 2);
      await this.write(text);
      this.repository.use(backend, 'file');
      this.version++;
      this.savedVersion = this.version;
      this.status = 'saved';
      this.error = '';
      this.conflict = false;
      clearTimeout(this.timer);
    } finally {
      this.transitioning = false;
    }
  }
  async remember() {
    try {
      if (!this.repository.browser.persistent)
        throw new Error('Browser connection storage is unavailable.');
      await this.repository.browser.setConnection({
        mode: this.mode,
        handle: this.handle,
      });
      this.warning = '';
    } catch {
      this.warning =
        'The file connection could not be remembered. Select the file again after reopening.';
    }
  }
  async restoreConnection() {
    let saved;
    try {
      saved = await this.repository.browser.getConnection();
    } catch {
      return false;
    }
    this.handle = saved?.handle ?? null;
    if (saved?.mode !== 'file') return false;
    try {
      if (!this.handle || !(await permission(this.handle)))
        throw new Error('Reconnect the workspace file to continue.');
      const connection = await readConnection(this.handle);
      const backup = await validateSnapshot(connection.text);
      this.repository.use(new MemoryRepository(backup), 'file');
      this.state.adoptWorkspace(backup);
      this.baseline = connection.baseline;
    } catch (error) {
      this.repository.use(new MemoryRepository(), 'file');
      this.needsReconnect = true;
      this.status = 'reconnect';
      this.error = error.message;
    }
    return true;
  }
  async reconnect() {
    if (!this.handle) return false;
    try {
      if (!(await permission(this.handle, true)))
        throw new Error(
          'Write permission was not granted. Choose another file or use Browser storage.',
        );
      if (this.needsReconnect) return this.switches.open(this.handle);
      return this.flush();
    } catch (error) {
      this.error = error.message;
      this.status = 'error';
      this.state.notify();
      return false;
    }
  }
  async overwrite() {
    try {
      this.baseline = (await readConnection(this.handle)).baseline;
      return this.flush();
    } catch (error) {
      this.error = error.message;
      this.state.notify();
      return false;
    }
  }
  dispose() {
    clearTimeout(this.timer);
  }
}
