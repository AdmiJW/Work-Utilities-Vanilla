import { createWorkspaceBackup, readWorkspaceBackup } from '../functions/workspace-backup.js';
import { exportBackupImages, restoreBackupImages } from '../functions/backup-images.js';
import { validateImageBlob } from '../../shared/image-data.js';

/** Includes unsaved live drafts and cold retained sessions without changing the UI. */
export async function snapshotWorkspace(state) {
  const summaries = structuredClone(state.summaries),
    workspace = state.workspace(),
    appearance = structuredClone(state.appearance);
  const documents = await Promise.all(
    summaries.map(async ({ id }) => {
      const value = state.document(id) ?? (await state.repository.read(id));
      if (!value)
        throw new Error(
          'A retained session could not be read. Recover it before saving the workspace.',
        );
      return structuredClone(value);
    }),
  );
  return createWorkspaceBackup(
    summaries,
    documents,
    workspace,
    appearance,
    await exportBackupImages(state, documents),
  );
}

export async function snapshotRepository(repository) {
  // Memory staging can be captured synchronously, before image encoding yields.
  if (repository.checkpoint) {
    const copy = repository.checkpoint();
    const summaries = structuredClone([...copy.summaries.values()]);
    const documents = structuredClone([...copy.documents.values()]);
    const workspace = structuredClone(copy.preferences.get('workspace')) ?? emptyWorkspace();
    const appearance = structuredClone(copy.preferences.get('appearance')) ?? {
      theme: 'light',
      collapsed: false,
    };
    return createWorkspaceBackup(
      summaries,
      documents,
      workspace,
      appearance,
      await exportBackupImages({ images: { read: async (id) => copy.images.get(id) } }, documents),
    );
  }
  const summaries = await repository.list();
  const workspace = (await repository.getPreference('workspace')) ?? {
    ...emptyWorkspace(),
    order: summaries.filter((s) => s.isOpen).map((s) => s.id),
  };
  if (!workspace.activeId && workspace.order.length) workspace.activeId = workspace.order[0];
  const appearance = (await repository.getPreference('appearance')) ?? {
    theme: 'light',
    collapsed: false,
  };
  const documents = await Promise.all(summaries.map(({ id }) => repository.read(id)));
  if (documents.some((doc) => !doc)) throw new Error('A retained session could not be read.');
  return createWorkspaceBackup(
    summaries,
    documents,
    workspace,
    appearance,
    await exportBackupImages({ images: { read: (id) => repository.readImage(id) } }, documents),
  );
}

function emptyWorkspace() {
  return {
    order: [],
    activeId: null,
    counters: { 'sql-formatter': 0, 'output-analyzer': 0, 'markdown-editor': 0 },
  };
}

export async function validateSnapshot(text) {
  const backup = readWorkspaceBackup(text);
  for (const { blob } of restoreBackupImages(backup)) await validateImageBlob(blob);
  return backup;
}

export function sameWorkspace(a, b) {
  const canonical = (backup) => {
    const { exportedAt: _exportedAt, ...content } = backup;
    for (const key of ['summaries', 'documents', 'images'])
      content[key] = [...(content[key] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const sort = (value) =>
      Array.isArray(value)
        ? value.map(sort)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, sort(value[key])]),
            )
          : value;
    return JSON.stringify(sort(content));
  };
  return canonical(a) === canonical(b);
}
