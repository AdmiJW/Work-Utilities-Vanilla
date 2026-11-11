import { preserveLatestView } from '../functions/session-recency.js';
import { restoreBackupImages } from '../functions/backup-images.js';

/** Independent staging store for a connected workspace file. */
export class MemoryRepository {
  constructor(backup) {
    this.summaries = new Map();
    this.documents = new Map();
    this.preferences = new Map();
    this.images = new Map();
    if (backup) this.replaceWorkspace(backup);
  }
  async list() {
    return structuredClone([...this.summaries.values()]);
  }
  async read(id) {
    return structuredClone(this.documents.get(id));
  }
  async readImage(id) {
    return this.images.get(id);
  }
  async getPreference(key) {
    return structuredClone(this.preferences.get(key));
  }
  async setPreference(key, value) {
    this.preferences.set(key, structuredClone(value));
  }
  async saveSummary(summary) {
    this.summaries.set(
      summary.id,
      preserveLatestView(structuredClone(summary), this.summaries.get(summary.id)),
    );
  }
  async recordAccess(id, lastViewedAt) {
    const summary = this.summaries.get(id);
    if (summary) await this.saveSummary({ ...summary, isOpen: true, lastViewedAt });
  }
  async save(summary, document, supplied = []) {
    const next = new Map(this.images),
      ids = new Set((document.unitTestImages ?? []).map((ref) => ref.id));
    for (const id of ids) {
      if (next.has(id) && next.get(id).sessionId === document.id) continue;
      const image = supplied.find((image) => image.id === id && image.sessionId === document.id);
      if (!image)
        throw new Error(
          'A screenshot could not be staged. Keep this session open and export a backup.',
        );
      next.set(id, image);
    }
    for (const [id, image] of next)
      if (image.sessionId === document.id && !ids.has(id)) next.delete(id);
    const body = structuredClone(document),
      metadata = preserveLatestView(structuredClone(summary), this.summaries.get(summary.id));
    this.documents.set(document.id, body);
    this.summaries.set(summary.id, metadata);
    this.images = next;
  }
  async commitLifecycle(summaries, workspace, permanently) {
    const nextSummaries = new Map(this.summaries),
      nextDocuments = new Map(this.documents),
      nextImages = new Map(this.images);
    const value = structuredClone(workspace);
    for (const summary of summaries) {
      if (permanently) {
        nextSummaries.delete(summary.id);
        nextDocuments.delete(summary.id);
        for (const [id, image] of nextImages)
          if (image.sessionId === summary.id) nextImages.delete(id);
      } else
        nextSummaries.set(
          summary.id,
          preserveLatestView({ ...summary, isOpen: false }, nextSummaries.get(summary.id)),
        );
    }
    this.summaries = nextSummaries;
    this.documents = nextDocuments;
    this.images = nextImages;
    this.preferences.set('workspace', value);
  }
  replaceWorkspace(backup) {
    const images = restoreBackupImages(backup);
    const summaries = new Map(structuredClone(backup.summaries).map((item) => [item.id, item]));
    const documents = new Map(structuredClone(backup.documents).map((item) => [item.id, item]));
    const preferences = new Map([
      ['workspace', structuredClone(backup.workspace)],
      ['appearance', structuredClone(backup.appearance)],
    ]);
    this.summaries = summaries;
    this.documents = documents;
    this.preferences = preferences;
    this.images = new Map(images.map((image) => [image.id, image]));
  }
  checkpoint() {
    return {
      summaries: new Map(this.summaries),
      documents: new Map(this.documents),
      preferences: new Map(this.preferences),
      images: new Map(this.images),
    };
  }
  rollback(checkpoint) {
    Object.assign(this, checkpoint);
  }
}
