import { SessionRepository } from './session-repository.js';

/** Stable identity: queued calls bind their backend before performing any IO. */
export class WorkspaceRepository {
  constructor(browser = new SessionRepository()) {
    this.browser = browser;
    this.backend = browser;
    this.mode = 'browser';
    this.pending = new Set();
    this.epoch = 0;
  }
  get persistent() {
    return this.mode === 'file' ? !this.persistence?.needsReconnect : this.browser.persistent;
  }
  get storageError() {
    return this.mode === 'file' ? (this.persistence?.warning ?? '') : this.browser.storageError;
  }
  initialize() {
    return this.browser.initialize();
  }
  use(backend, mode) {
    this.backend = backend;
    this.mode = mode;
    this.epoch++;
  }
  call(method, args, mutation = false) {
    const backend = this.backend;
    const task = Promise.resolve().then(() => backend[method](...args));
    this.pending.add(task);
    task.then(
      () => this.pending.delete(task),
      () => this.pending.delete(task),
    );
    if (mutation && this.mode === 'file' && !(method === 'save' && this.persistence?.staging))
      this.persistence?.changed();
    return task;
  }
  async settled() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
  list() {
    return this.call('list', []);
  }
  read(id) {
    return this.call('read', [id]);
  }
  readImage(id) {
    return this.call('readImage', [id]);
  }
  getPreference(key) {
    return this.call('getPreference', [key]);
  }
  save(...args) {
    return this.call('save', args, true);
  }
  saveSummary(...args) {
    return this.call('saveSummary', args, true);
  }
  recordAccess(...args) {
    return this.call('recordAccess', args, true);
  }
  setPreference(...args) {
    return this.call('setPreference', args, true);
  }
  async commitLifecycle(...args) {
    if (this.mode !== 'file') return this.call('commitLifecycle', args);
    const backend = this.backend,
      before = backend.checkpoint();
    try {
      await backend.commitLifecycle(...args);
      await this.persistence.commitStaged();
    } catch (error) {
      backend.rollback(before);
      throw error;
    }
  }
  replaceWorkspace(backup) {
    return this.mode === 'file'
      ? this.persistence.replace(backup)
      : this.call('replaceWorkspace', [backup]);
  }
}
