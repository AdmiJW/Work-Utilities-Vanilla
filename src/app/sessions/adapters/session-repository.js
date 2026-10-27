import Dexie from 'dexie';
import { preserveLatestView } from '../functions/session-recency.js';
import { ImageStorage } from './image-storage.js';
import { restoreBackupImages } from '../functions/backup-images.js';

export class SessionRepository {
  constructor(name = 'work-utilities-vanilla') {
    this.database = new Dexie(name);
    this.database
      .version(1)
      .stores({ summaries: 'id, toolId, updatedAt', documents: 'id', preferences: 'key' });
    this.database.version(2).stores({ sessionImages: 'id, sessionId' });
    this.summaries = this.database.table('summaries');
    this.documents = this.database.table('documents');
    this.preferences = this.database.table('preferences');
    this.persistent = true;
    this.storageError = '';
    this.memory = { summaries: new Map(), documents: new Map(), preferences: new Map() };
    this.images = new ImageStorage(this);
  }

  async initialize() {
    try {
      await this.database.open();
    } catch {
      this.persistent = false;
      this.storageError =
        'Browser storage is unavailable. This workspace is in memory only. Export a backup before closing.';
    }
  }

  async list() {
    return this.persistent ? this.summaries.toArray() : [...this.memory.summaries.values()];
  }

  async read(id) {
    const document = this.persistent ? await this.documents.get(id) : this.memory.documents.get(id);
    if (document && document.schemaVersion !== 1)
      throw new Error('This session was saved by an unsupported application version.');
    return document ? structuredClone(document) : undefined;
  }

  async save(summary, document, images = []) {
    if (!this.persistent) {
      await this.images.save(document, images);
      this.memory.summaries.set(
        summary.id,
        preserveLatestView(structuredClone(summary), this.memory.summaries.get(summary.id)),
      );
      this.memory.documents.set(document.id, structuredClone(document));
      return;
    }
    await this.database.transaction(
      'rw',
      this.summaries,
      this.documents,
      this.images.table,
      async () => {
        await this.images.save(document, images);
        await this.summaries.put(preserveLatestView(summary, await this.summaries.get(summary.id)));
        await this.documents.put(document);
      },
    );
  }

  readImage(id) {
    return this.images.read(id);
  }

  async saveSummary(summary) {
    if (!this.persistent) {
      this.memory.summaries.set(
        summary.id,
        preserveLatestView(structuredClone(summary), this.memory.summaries.get(summary.id)),
      );
      return;
    }
    await this.database.transaction('rw', this.summaries, async () => {
      await this.summaries.put(preserveLatestView(summary, await this.summaries.get(summary.id)));
    });
  }

  async recordAccess(id, lastViewedAt) {
    if (!this.persistent) {
      const stored = this.memory.summaries.get(id);
      if (stored)
        this.memory.summaries.set(
          id,
          preserveLatestView({ ...stored, isOpen: true, lastViewedAt }, stored),
        );
      return;
    }
    await this.database.transaction('rw', this.summaries, async () => {
      const stored = await this.summaries.get(id);
      if (stored)
        await this.summaries.put(
          preserveLatestView({ ...stored, isOpen: true, lastViewedAt }, stored),
        );
    });
  }

  async commitLifecycle(summaries, workspace, permanently) {
    if (!this.persistent) {
      for (const summary of summaries) {
        if (permanently) {
          await this.images.remove(summary.id);
          this.memory.summaries.delete(summary.id);
          this.memory.documents.delete(summary.id);
        } else
          this.memory.summaries.set(
            summary.id,
            preserveLatestView(
              { ...summary, isOpen: false },
              this.memory.summaries.get(summary.id),
            ),
          );
      }
      this.memory.preferences.set('workspace', structuredClone(workspace));
      return;
    }
    await this.database.transaction(
      'rw',
      this.summaries,
      this.documents,
      this.preferences,
      this.images.table,
      async () => {
        for (const summary of summaries) {
          if (permanently) {
            await this.images.remove(summary.id);
            await this.summaries.delete(summary.id);
            await this.documents.delete(summary.id);
          } else
            await this.summaries.put(
              preserveLatestView(
                { ...summary, isOpen: false },
                await this.summaries.get(summary.id),
              ),
            );
        }
        await this.preferences.put({ key: 'workspace', value: workspace });
      },
    );
  }

  async getPreference(key) {
    return this.persistent
      ? (await this.preferences.get(key))?.value
      : this.memory.preferences.get(key);
  }

  async setPreference(key, value) {
    if (this.persistent) await this.preferences.put({ key, value });
    else this.memory.preferences.set(key, structuredClone(value));
  }

  async replaceWorkspace(backup) {
    const images = restoreBackupImages(backup);
    if (!this.persistent) {
      const memory = {
        summaries: new Map(backup.summaries.map((item) => [item.id, structuredClone(item)])),
        documents: new Map(backup.documents.map((item) => [item.id, structuredClone(item)])),
        preferences: new Map([
          ['workspace', structuredClone(backup.workspace)],
          ['appearance', structuredClone(backup.appearance)],
        ]),
      };
      this.memory = memory;
      this.images.memory = new Map(images.map((image) => [image.id, image]));
      return;
    }
    await this.database.transaction(
      'rw',
      this.summaries,
      this.documents,
      this.preferences,
      this.images.table,
      async () => {
        await this.summaries.clear();
        await this.documents.clear();
        await this.preferences.clear();
        await this.images.table.clear();
        await this.images.table.bulkPut(images);
        await this.summaries.bulkPut(backup.summaries);
        await this.documents.bulkPut(backup.documents);
        await this.preferences.bulkPut([
          { key: 'workspace', value: backup.workspace },
          { key: 'appearance', value: backup.appearance },
        ]);
      },
    );
  }
}
