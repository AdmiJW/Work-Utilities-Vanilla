import { createSession } from './session-creation.js';
import { SessionAutosave } from './session-autosave.js';
import { SessionLifecycle } from './session-lifecycle.js';
import { nextViewedAt, recentSessions } from '../functions/session-recency.js';
import { SessionImages } from './session-images.js';
import { normalizeBaseName, sessionFileName } from '../functions/session-filename.js';

export class SessionState extends EventTarget {
  constructor(repository) {
    super();
    this.repository = repository;
    this.summaries = [];
    this.documents = new Map();
    this.order = [];
    this.counters = { 'sql-formatter': 0, 'output-analyzer': 0, 'markdown-editor': 0 };
    this.activeId = null;
    this.openingId = null;
    this.openingError = '';
    this.error = '';
    this.ready = false;
    this.busy = false;
    this.navigation = 0;
    this.generation = 0;
    this.appearance = { theme: 'light', collapsed: false };
    this.preferenceQueue = Promise.resolve();
    this.autosave = new SessionAutosave(repository, () => this.notify());
    this.lifecycle = new SessionLifecycle(this);
    this.images = new SessionImages(this);
  }

  notify() {
    this.dispatchEvent(new Event('change'));
  }
  get activeSession() {
    return this.summaries.find((item) => item.id === this.activeId);
  }
  get openSessions() {
    return this.order
      .map((id) => this.summaries.find((item) => item.id === id))
      .filter((item) => item?.isOpen);
  }
  get recentSessions() {
    return recentSessions(this.summaries);
  }
  document(id) {
    return this.documents.get(id);
  }
  workspace() {
    return { order: [...this.order], activeId: this.activeId, counters: { ...this.counters } };
  }
  fail(error) {
    this.error = error.message || 'Browser storage is unavailable.';
    this.notify();
  }

  async initialize() {
    await this.repository.initialize();
    if (await this.persistence?.restoreConnection()) {
      this.ready = true;
      this.notify();
      return;
    }
    await this.load();
    this.ready = true;
    this.notify();
  }

  async load() {
    this.summaries = await this.repository.list();
    const saved = await this.repository.getPreference('workspace');
    this.appearance = (await this.repository.getPreference('appearance')) ?? {
      theme: 'light',
      collapsed: false,
    };
    const open = this.summaries.filter((item) => item.isOpen).map((item) => item.id);
    this.order = [...new Set([...(saved?.order ?? []).filter((id) => open.includes(id)), ...open])];
    this.counters = {
      'sql-formatter': 0,
      'output-analyzer': 0,
      'markdown-editor': 0,
      ...saved?.counters,
    };
    const activeId = this.order.includes(saved?.activeId) ? saved.activeId : this.order[0];
    if (activeId) await this.activate(activeId);
  }

  cancelNavigation() {
    this.navigation++;
    this.openingId = null;
    this.openingError = '';
  }

  adoptWorkspace(backup) {
    this.cancelNavigation();
    this.documents = new Map(structuredClone(backup.documents).map((doc) => [doc.id, doc]));
    this.summaries = structuredClone(backup.summaries);
    this.order = [...backup.workspace.order];
    this.counters = { 'markdown-editor': 0, ...backup.workspace.counters };
    this.appearance = structuredClone(backup.appearance);
    this.activeId = backup.workspace.activeId;
    this.images.cache.clear();
    this.error = '';
    this.openingError = '';
    this.generation++;
  }

  create(toolId, name, source = '', initial = {}) {
    return createSession(this, toolId, name, source, initial);
  }

  async activate(id, recordView = true) {
    if (this.busy) return false;
    if (this.activeId === id) {
      this.cancelNavigation();
      this.notify();
      return true;
    }
    if (this.openingId === id || !this.summaries.some((item) => item.id === id)) return false;
    const request = ++this.navigation;
    this.openingId = id;
    this.openingError = '';
    this.notify();
    try {
      const document = this.document(id) ?? (await this.repository.read(id));
      if (request !== this.navigation) return false;
      if (!document)
        throw new Error(
          'The saved document could not be found. Select the session again to retry.',
        );
      const summary = this.summaries.find((item) => item.id === id);
      if (!summary || this.busy) return false;
      const lastViewedAt = recordView ? nextViewedAt(this.summaries) : summary.lastViewedAt;
      this.documents.set(
        id,
        this.document(id) ?? {
          ...document,
          fileBaseName: sessionFileName(document, summary),
          fileNameCustomized: document.fileNameCustomized ?? false,
        },
      );
      this.summaries = this.summaries.map((item) =>
        item.id === id
          ? { ...item, isOpen: true, ...(lastViewedAt === undefined ? {} : { lastViewedAt }) }
          : item,
      );
      if (!summary.isOpen) this.order = [...this.order.filter((item) => item !== id), id];
      this.activeId = id;
      this.persistWorkspace();
      if (recordView || !summary.isOpen) {
        const access = this.repository.recordAccess(id, lastViewedAt);
        this.preferenceQueue = Promise.all([this.preferenceQueue, access])
          .then(() => {})
          .catch((error) => this.fail(error));
      }
      return true;
    } catch (error) {
      if (request === this.navigation)
        this.openingError = error.message || 'This session could not be opened.';
      return false;
    } finally {
      if (request === this.navigation) {
        this.openingId = null;
        this.notify();
      }
    }
  }

  updateSource(id, source) {
    if (this.busy) return;
    const document = this.document(id);
    if (!document || document.source === source) return;
    this.documents.set(id, {
      ...document,
      source,
      revision: document.revision + 1,
      options: { ...document.options, analyzed: false },
    });
    this.touch(id);
  }

  fileName(id) {
    return sessionFileName(
      this.document(id),
      this.summaries.find((item) => item.id === id),
    );
  }

  setFileName(id, value, customized = true) {
    const document = this.document(id);
    const fileBaseName = normalizeBaseName(value);
    if (this.busy || !document || !fileBaseName || (!customized && document.fileNameCustomized))
      return;
    if (document.fileBaseName === fileBaseName && (!customized || document.fileNameCustomized))
      return;
    this.documents.set(id, { ...document, fileBaseName, fileNameCustomized: customized });
    this.touch(id);
  }

  updateOptions(id, options) {
    if (this.busy) return;
    const document = this.document(id);
    if (!document) return;
    if (
      Object.entries(options).every(
        ([key, value]) => JSON.stringify(document.options[key]) === JSON.stringify(value),
      )
    )
      return;
    this.documents.set(id, { ...document, options: { ...document.options, ...options } });
    this.touch(id);
  }

  rename(id, name) {
    if (this.busy || !name?.trim()) return;
    this.summaries = this.summaries.map((item) =>
      item.id === id
        ? {
            ...item,
            legacyFileBaseName: item.legacyFileBaseName ?? this.fileName(id),
            name: name.trim(),
          }
        : item,
    );
    this.touch(id);
    if (!this.document(id)) {
      const summary = this.summaries.find((item) => item.id === id);
      if (summary)
        this.preferenceQueue = this.preferenceQueue
          .then(() => this.repository.saveSummary(summary))
          .catch((error) => this.fail(error));
    }
  }

  touch(id) {
    this.summaries = this.summaries.map((item) =>
      item.id === id ? { ...item, updatedAt: Date.now() } : item,
    );
    const summary = this.summaries.find((item) => item.id === id);
    if (summary && this.document(id))
      this.autosave.schedule(summary, this.document(id), this.images.pending(this.document(id)));
    this.notify();
  }

  reorder(ids) {
    if (
      this.busy ||
      ids.length !== this.order.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !this.order.includes(id))
    )
      return;
    this.order = [...ids];
    this.persistWorkspace();
    this.notify();
  }

  close(id) {
    return this.closeMany([id]);
  }

  saveActive(extraSessionId) {
    if (this.busy || this.openingId) return Promise.resolve({ status: 'busy', ids: [] });
    if (this.persistence?.mode === 'file')
      return this.persistence.flush().then((success) => ({
        status: success ? 'saved' : 'error',
        ids: [],
        error: this.persistence.error,
      }));
    const ids = [
      ...new Set(
        [this.activeId, extraSessionId].filter(
          (id) => id && this.summaries.some((s) => s.id === id),
        ),
      ),
    ];
    if (!ids.length) return Promise.resolve({ status: 'no-session', ids: [] });
    this.manualSaveIds ??= new Set();
    for (const id of ids) this.manualSaveIds.add(id);
    if (this.manualSavePromise) return this.manualSavePromise;
    const generation = this.generation,
      previousError = this.error;
    this.manualSavePromise = (async () => {
      const saved = new Set();
      while (this.manualSaveIds.size) {
        const batch = [...this.manualSaveIds];
        this.manualSaveIds.clear();
        await this.preferenceQueue;
        if (this.busy || this.generation !== generation) return { status: 'busy', ids: [...saved] };
        if (this.error && this.error !== previousError)
          return { status: 'error', ids: [...saved], error: this.error };
        for (const id of batch) {
          if (!this.summaries.some((s) => s.id === id)) continue;
          if (!(await this.autosave.flush(id)))
            return { status: 'error', ids: [...saved], error: this.autosave.error };
          saved.add(id);
        }
      }
      return { status: this.repository.persistent ? 'saved' : 'memory-only', ids: [...saved] };
    })()
      .catch((error) => ({ status: 'error', ids: [], error: error.message }))
      .finally(() => {
        this.manualSavePromise = null;
        this.manualSaveIds.clear();
      });
    return this.manualSavePromise;
  }
  closeMany(ids) {
    return this.lifecycle.remove(ids, false);
  }
  deleteMany(ids) {
    return this.lifecycle.remove(ids, true);
  }

  persistWorkspace() {
    const snapshot = this.workspace();
    this.preferenceQueue = this.preferenceQueue
      .then(() => this.repository.setPreference('workspace', snapshot))
      .catch((error) => this.fail(error));
    return this.preferenceQueue;
  }

  setAppearance(changes) {
    if (this.busy) return;
    this.appearance = { ...this.appearance, ...changes };
    const snapshot = structuredClone(this.appearance),
      repository = this.repository;
    this.preferenceQueue = this.preferenceQueue
      .then(() => repository.setPreference('appearance', snapshot))
      .catch((error) => this.fail(error));
    this.notify();
  }
}
