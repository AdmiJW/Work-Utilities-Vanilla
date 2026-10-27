/** Immutable image blobs stay outside document/autosave JSON and are loaded on demand. */
export class SessionImages {
  constructor(state) {
    this.state = state;
    this.cache = new Map();
  }

  add(sessionId, images) {
    const state = this.state;
    const document = state.document(sessionId);
    if (state.busy || !document || !images.length) return;
    const references = images.map(({ blob, ...metadata }) => {
      const id = crypto.randomUUID();
      this.cache.set(id, { id, sessionId, blob });
      return { id, ...metadata };
    });
    state.documents.set(sessionId, {
      ...document,
      unitTestImages: [...(document.unitTestImages ?? []), ...references],
    });
    state.touch(sessionId);
  }

  reorder(sessionId, ids) {
    const state = this.state;
    const document = state.document(sessionId);
    const images = document?.unitTestImages ?? [];
    if (
      state.busy ||
      !document ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !images.some((image) => image.id === id))
    )
      return;
    state.documents.set(sessionId, {
      ...document,
      unitTestImages: ids.map((id) => images.find((image) => image.id === id)),
    });
    state.touch(sessionId);
  }

  pending(document) {
    return (document.unitTestImages ?? []).flatMap(({ id }) =>
      this.cache.has(id) ? [this.cache.get(id)] : [],
    );
  }

  async read(id) {
    const generation = this.state.generation;
    const image = this.cache.get(id) ?? (await this.state.repository.readImage(id));
    if (generation !== this.state.generation)
      throw new DOMException('This workspace was replaced.', 'AbortError');
    if (!image)
      throw new Error(
        'A saved screenshot could not be found. Restore a workspace backup or remove that screenshot.',
      );
    this.cache.set(id, image);
    return image;
  }

  release(ids) {
    for (const [id, image] of this.cache) if (ids.includes(image.sessionId)) this.cache.delete(id);
  }
}
