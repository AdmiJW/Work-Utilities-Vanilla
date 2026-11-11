import { readWorkspaceBackup } from '../functions/workspace-backup.js';
import { restoreBackupImages } from '../functions/backup-images.js';
import { validateImageBlob } from '../../shared/image-data.js';
import { snapshotWorkspace } from './workspace-snapshot.js';

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
      return await snapshotWorkspace(state);
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
      for (const { blob } of restoreBackupImages(validated)) await validateImageBlob(blob);
      await state.autosave.flush();
      await state.preferenceQueue;
      await state.repository.replaceWorkspace(validated);
      await state.autosave.discard(state.summaries.map((item) => item.id));
      state.adoptWorkspace(validated);
      state.busy = false;
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
