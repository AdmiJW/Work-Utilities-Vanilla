/** Serializes writes and drains revisions before closing a session. */
export class SessionAutosave {
  constructor(repository, changed) {
    this.repository = repository;
    this.changed = changed;
    this.pending = new Map();
    this.timers = new Map();
    this.queues = new Map();
    this.status = 'saved';
    this.error = '';
    this.revision = 0;
  }

  schedule(summary, document) {
    this.pending.set(summary.id, {
      summary: structuredClone(summary),
      document: structuredClone(document),
      revision: ++this.revision,
    });
    clearTimeout(this.timers.get(summary.id));
    this.status = 'saving';
    this.timers.set(
      summary.id,
      setTimeout(() => void this.flush(summary.id), 10_000),
    );
  }

  async flush(id) {
    const ids = id ? [id] : [...new Set([...this.pending.keys(), ...this.queues.keys()])];
    const results = await Promise.all(
      ids.map(async (key) => {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
        let success = true;
        const task = (this.queues.get(key) ?? Promise.resolve()).then(async () => {
          while (this.pending.has(key)) {
            const snapshot = this.pending.get(key);
            try {
              await this.repository.save(snapshot.summary, snapshot.document);
              if (this.pending.get(key)?.revision === snapshot.revision) this.pending.delete(key);
            } catch (error) {
              success = false;
              this.status = 'error';
              this.error = error.message || 'Browser storage could not save this session.';
              break;
            }
          }
        });
        this.queues.set(key, task);
        await task;
        if (this.queues.get(key) === task) this.queues.delete(key);
        return success;
      }),
    );
    if (results.every(Boolean) && !this.pending.size && !this.queues.size) {
      this.status = 'saved';
      this.error = '';
    }
    this.changed();
    return results.every(Boolean);
  }

  async discard(ids) {
    for (const id of ids) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
      this.pending.delete(id);
    }
    await Promise.all(ids.map((id) => this.queues.get(id)));
    if (!this.pending.size) {
      this.status = 'saved';
      this.error = '';
    }
  }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
  }
}
