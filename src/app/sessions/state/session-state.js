import { SessionAutosave } from './session-autosave.js';
import { SessionLifecycle } from './session-lifecycle.js';
import { nextViewedAt, recentSessions } from '../functions/session-recency.js';

export class SessionState extends EventTarget {
  constructor(repository) {
    super();
    this.repository = repository;
    this.summaries = [];
    this.documents = new Map();
    this.order = [];
    this.counters = { 'sql-formatter': 0, 'output-analyzer': 0 };
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
    this.counters = { 'sql-formatter': 0, 'output-analyzer': 0, ...saved?.counters };
    const activeId = this.order.includes(saved?.activeId) ? saved.activeId : this.order[0];
    if (activeId) await this.activate(activeId);
  }

  cancelNavigation() {
    this.navigation++;
    this.openingId = null;
    this.openingError = '';
  }

  async create(toolId, name, source = '') {
    if (this.busy) return null;
    this.cancelNavigation();
    const id = crypto.randomUUID();
    const number = ++this.counters[toolId];
    const title = toolId === 'sql-formatter' ? 'SQL Formatter' : 'Output Analyzer';
    const now = Date.now();
    const summary = {
      id,
      toolId,
      name: name ?? `${title} ${String(number).padStart(2, '0')}`,
      createdAt: now,
      updatedAt: now,
      lastViewedAt: nextViewedAt(this.summaries),
      isOpen: true,
    };
    const document = { id, schemaVersion: 1, source, revision: 0, options: {} };
    this.summaries = [...this.summaries, summary];
    this.documents.set(id, document);
    this.order.push(id);
    this.activeId = id;
    this.autosave.schedule(summary, document);
    this.persistWorkspace();
    this.notify();
    await this.autosave.flush(id);
    return id;
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
      this.documents.set(id, this.document(id) ?? document);
      this.summaries = this.summaries.map((item) =>
        item.id === id
          ? { ...item, isOpen: true, ...(lastViewedAt === undefined ? {} : { lastViewedAt }) }
          : item,
      );
      if (!summary.isOpen) this.order = [...this.order.filter((item) => item !== id), id];
      this.activeId = id;
      this.persistWorkspace();
      if (recordView || !summary.isOpen)
        void this.repository.recordAccess(id, lastViewedAt).catch((error) => this.fail(error));
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
      item.id === id ? { ...item, name: name.trim() } : item,
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
    if (summary && this.document(id)) this.autosave.schedule(summary, this.document(id));
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
    void this.repository
      .setPreference('appearance', this.appearance)
      .catch((error) => this.fail(error));
    this.notify();
  }
}
