import { WorkspaceBackups } from '../../sessions/public-api.js';
import { chooseFile, downloadFile } from '../../file-transfer/public-api.js';
import { confirmAction } from '../../shared/dialog.js';

export function createWorkspaceBackupActions(state) {
  const backups = new WorkspaceBackups(state);
  const run = async (action) => {
    try {
      await action();
    } catch (error) {
      state.fail(error);
    }
  };
  const backup = () =>
    run(async () => {
      const value = await backups.export();
      downloadFile(
        JSON.stringify(value, null, 2),
        `work-utilities-workspace-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      );
    });
  const restore = () =>
    run(async () => {
      const file = await chooseFile('.json');
      if (!file) return;
      const value = backups.validate(await file.text());
      if (
        await confirmAction(
          'Restore workspace?',
          `Replace the current workspace with ${value.summaries.length} saved session(s), including its tabs and preferences? Export your current workspace first if you need to keep it.`,
          'Restore workspace',
        )
      )
        await backups.restore(value);
    });

  return { backup, restore };
}
