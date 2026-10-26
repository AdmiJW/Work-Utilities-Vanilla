export class SessionLifecycle {
  constructor(state) {
    this.state = state;
  }

  async remove(ids, permanently) {
    const state = this.state;
    if (state.busy) return false;
    const targets = state.summaries.filter(
      (item) => ids.includes(item.id) && (permanently || item.isOpen),
    );
    if (!targets.length) return true;
    state.cancelNavigation();
    state.busy = true;
    state.error = '';
    state.notify();
    const removed = new Set(targets.map((item) => item.id));
    const order = state.order.filter((id) => !removed.has(id));
    const previousActive = state.activeId;
    const index = state.order.indexOf(previousActive);
    const activeId =
      previousActive && !removed.has(previousActive)
        ? previousActive
        : (state.order.slice(0, index).findLast((id) => !removed.has(id)) ?? order[0] ?? null);
    try {
      if (
        !permanently &&
        !(await Promise.all(targets.map((item) => state.autosave.flush(item.id)))).every(Boolean)
      )
        throw new Error(
          'Save failed. The selected tabs remain open so you can recover their content.',
        );
      await state.autosave.discard([...removed]);
      await state.preferenceQueue;
      await state.repository.commitLifecycle(
        targets,
        { order, activeId, counters: { ...state.counters } },
        permanently,
      );
      state.summaries = permanently
        ? state.summaries.filter((item) => !removed.has(item.id))
        : state.summaries.map((item) => (removed.has(item.id) ? { ...item, isOpen: false } : item));
      state.order = order;
      for (const id of removed) state.documents.delete(id);
      state.busy = false;
      if (activeId !== previousActive) {
        state.activeId = null;
        if (activeId) await state.activate(activeId, false);
      }
      state.notify();
      return true;
    } catch (error) {
      state.fail(error);
      return false;
    } finally {
      state.busy = false;
      state.notify();
    }
  }
}
