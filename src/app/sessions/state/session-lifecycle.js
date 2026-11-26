export class SessionLifecycle {
  constructor(state) {
    this.state = state;
  }

  async remove(ids, permanently, { tree, saveIds = [], destinationId } = {}) {
    const state = this.state;
    if (state.busy) return false;
    const targets = state.summaries.filter(
      (item) => ids.includes(item.id) && (permanently || item.isOpen),
    );
    if (!targets.length && !tree) return true;
    state.cancelNavigation();
    state.busy = true;
    state.error = '';
    state.notify();
    const removed = new Set(targets.map((item) => item.id));
    const savedTargets = targets.filter(({ id }) => !state.temporary.has(id));
    const order = state.order.filter((id) => !removed.has(id));
    const previousActive = state.activeId;
    const index = state.order.indexOf(previousActive);
    const activeId =
      previousActive && !removed.has(previousActive)
        ? previousActive
        : (state.order.slice(0, index).findLast((id) => !removed.has(id)) ?? order[0] ?? null);
    let library = tree ?? state.library.tree;
    if (permanently)
      library = {
        ...library,
        placements: Object.fromEntries(
          Object.entries(library.placements).filter(([id]) => !removed.has(id)),
        ),
      };
    const toSave = state.repository.mode === 'file' ? [] : [...saveIds];
    if (!permanently) toSave.push(...savedTargets.map(({ id }) => id));
    const apply = () => {
      state.library.tree = library;
      state.library.destinationId =
        state.library.folder(
          destinationId === undefined ? state.library.destinationId : destinationId,
        )?.id ?? null;
      state.summaries = state.summaries
        .filter(({ id }) => !(removed.has(id) && (permanently || state.temporary.has(id))))
        .map((item) => (removed.has(item.id) ? { ...item, isOpen: false } : item));
      state.order = order;
      for (const id of removed) {
        state.documents.delete(id);
        state.temporary.delete(id);
        state.library.pendingPlacements.delete(id);
      }
      state.images.release([...removed]);
    };
    try {
      if (!(await Promise.all(toSave.map((id) => state.autosave.flush(id)))).every(Boolean))
        throw new Error(
          tree
            ? 'Save failed. The library could not be updated.'
            : 'Save failed. The selected tabs remain open so you can recover their content.',
        );
      if (savedTargets.length || tree) {
        await state.autosave.discard(savedTargets.map(({ id }) => id));
        const commit = async (committedOnly) => {
          await state.repository.commitLifecycle(
            savedTargets,
            state.workspace({ order, activeId, library, destinationId, committedOnly }),
            permanently,
          );
          apply();
        };
        if (state.repository.mode === 'file') {
          await state.preferenceQueue;
          // The File repository drains staging first, then writes the complete workspace.
          await commit(false);
        } else await state.queueWorkspaceWrite(() => commit(true));
      } else apply();
      state.busy = false;
      if (activeId !== previousActive) {
        state.activeId = null;
        if (activeId) await state.activate(activeId, false, false);
      }
      state.notify();
      return true;
    } catch (error) {
      // Deletion cancels pending writes before its transaction. If that transaction
      // fails, requeue live documents so a later close cannot archive stale data.
      if (permanently)
        for (const summary of savedTargets) {
          const document = state.document(summary.id);
          if (document) state.autosave.schedule(summary, document, state.images.pending(document));
        }
      state.fail(error);
      return false;
    } finally {
      state.busy = false;
      state.notify();
    }
  }
}
