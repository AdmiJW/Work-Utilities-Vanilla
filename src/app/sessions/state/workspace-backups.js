import { createWorkspaceBackup, readWorkspaceBackup } from '../functions/workspace-backup.js';

export class WorkspaceBackups {
  constructor(state) {
    this.state = state;
  }

  async export() {
    const state = this.state;
    if (state.busy) throw new Error('Wait for the current workspace operation to finish.');
    state.busy = true;
    state.cancelNavigation();
    state.notify();
    try {
      // A failed autosave must not prevent recovery of the in-memory source.
      await state.autosave.flush();
      const summaries = structuredClone(state.summaries);
      const workspace = state.workspace();
      const appearance = structuredClone(state.appearance);
      const documents = await Promise.all(
        summaries.map(async ({ id }) => {
          const document = state.document(id) ?? (await state.repository.read(id));
          if (!document)
            throw new Error(
              'One saved session could not be read. Reopen or recover it before exporting the whole workspace.',
            );
          return structuredClone(document);
        }),
      );
      return createWorkspaceBackup(summaries, documents, workspace, appearance);
    } finally {
      state.busy = false;
      state.notify();
    }
  }

  validate(text) {
    return readWorkspaceBackup(text);
  }

  async restore(backup) {
    const state = this.state;
    if (state.busy) return false;
    // Also validate programmatic callers, before suspending any existing work.
    const validated = readWorkspaceBackup(JSON.stringify(backup));
    state.busy = true;
    state.cancelNavigation();
    state.notify();
    try {
      await state.autosave.flush();
      await state.preferenceQueue;
      await state.repository.replaceWorkspace(validated);
      await state.autosave.discard(state.summaries.map((item) => item.id));
      state.documents = new Map(
        validated.documents.map((document) => [document.id, structuredClone(document)]),
      );
      state.summaries = structuredClone(validated.summaries);
      state.order = [...validated.workspace.order];
      state.counters = { ...validated.workspace.counters };
      state.appearance = structuredClone(validated.appearance);
      state.activeId = null;
      state.generation++;
      state.error = '';
      state.busy = false;
      if (validated.workspace.activeId) await state.activate(validated.workspace.activeId);
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
