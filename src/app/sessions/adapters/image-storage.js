export class ImageStorage {
  constructor(repository) {
    this.repository = repository;
    this.table = repository.database.table('sessionImages');
    this.memory = new Map();
  }

  async read(id) {
    return this.repository.persistent ? this.table.get(id) : this.memory.get(id);
  }

  async save(document, supplied) {
    const ids = new Set((document.unitTestImages ?? []).map((image) => image.id));
    const existing = this.repository.persistent
      ? await this.table.where('sessionId').equals(document.id).primaryKeys()
      : [...this.memory.values()]
          .filter((image) => image.sessionId === document.id)
          .map((image) => image.id);
    const known = new Set(existing);
    for (const id of ids) {
      if (known.has(id)) continue;
      const image = supplied.find((image) => image.id === id && image.sessionId === document.id);
      if (!image)
        throw new Error(
          'A screenshot could not be saved. Keep this session open and export a backup.',
        );
      if (this.repository.persistent) await this.table.add(image);
      else this.memory.set(id, image);
    }
    const removed = existing.filter((id) => !ids.has(id));
    if (this.repository.persistent) await this.table.bulkDelete(removed);
    else for (const id of removed) this.memory.delete(id);
  }

  async remove(sessionId) {
    if (this.repository.persistent) await this.table.where('sessionId').equals(sessionId).delete();
    else
      for (const [id, image] of this.memory)
        if (image.sessionId === sessionId) this.memory.delete(id);
  }
}
