import {
  emptyLibrary,
  libraryFolderId,
  libraryFolderNameError,
  librarySubtree,
  validLibrary,
} from '../functions/library-tree.js';

export class SessionLibrary {
  constructor(state) {
    this.state = state;
    this.tree = emptyLibrary();
    this.destinationId = null;
    this.pendingPlacements = new Set();
  }

  load(workspace) {
    const stored = workspace?.library;
    this.tree = validLibrary(stored, new Set(this.state.savedSessions.map(({ id }) => id)))
      ? structuredClone(stored)
      : emptyLibrary();
    this.destinationId = this.folder(workspace?.newSessionFolderId)?.id ?? null;
    this.pendingPlacements.clear();
  }

  folder(id) {
    return this.tree.folders.find((folder) => folder.id === id);
  }

  setDestination(id) {
    if (this.state.busy || (id !== null && !this.folder(id))) return false;
    if (id === this.destinationId) return true;
    return this.state.lifecycle.remove([], false, { tree: this.tree, destinationId: id });
  }

  placeNew(id) {
    if (this.destinationId === null) return;
    this.tree = {
      ...this.tree,
      placements: { ...this.tree.placements, [id]: this.destinationId },
    };
    this.pendingPlacements.add(id);
  }

  savePlacement({ summary, document, images }) {
    if (!this.pendingPlacements.has(summary.id)) return;
    const state = this.state;
    return state.queueWorkspaceWrite(async () => {
      // Publish the placement alongside its document. Other drafts may still be unsaved.
      const workspace = state.workspace({ committedOnly: true, savingId: summary.id });
      await state.repository.save(summary, document, images, workspace);
      this.pendingPlacements.delete(summary.id);
    });
  }

  nameError(parentId, name, exceptId) {
    if (parentId !== null && !this.folder(parentId)) return 'That destination no longer exists.';
    return libraryFolderNameError(this.tree, parentId, name.trim(), exceptId);
  }

  saveFolder(parentId, name, id = null) {
    if ((id !== null && !this.folder(id)) || this.nameError(parentId, name, id)) return false;
    name = name.trim();
    if (this.folder(id)?.name === name) return true;
    const folder = { id: id ?? crypto.randomUUID(), parentId, name };
    return this.state.lifecycle.remove([], false, {
      tree: {
        ...this.tree,
        folders: id
          ? this.tree.folders.map((item) => (item.id === id ? folder : item))
          : [...this.tree.folders, folder],
      },
    });
  }

  moveError(item, parentId) {
    if (parentId !== null && !this.folder(parentId)) return 'That destination no longer exists.';
    if (item.folderId) {
      const folder = this.folder(item.folderId);
      if (!folder) return 'That folder no longer exists.';
      if (librarySubtree(this.tree, folder.id).folders.has(parentId))
        return 'Choose a destination outside this folder.';
      if (folder.parentId === parentId) return 'This folder is already here.';
      return this.nameError(parentId, folder.name, folder.id);
    }
    const saved = new Set(this.state.savedSessions.map(({ id }) => id));
    if (!item.ids.length || item.ids.some((id) => !saved.has(id)))
      return 'A selected session no longer exists.';
    if (item.ids.every((id) => libraryFolderId(this.tree, id) === parentId))
      return 'The selected sessions are already here.';
    return '';
  }

  move(item, parentId) {
    if (this.moveError(item, parentId)) return false;
    if (item.folderId) {
      const folders = this.tree.folders.map((folder) =>
        folder.id === item.folderId ? { ...folder, parentId } : folder,
      );
      return this.state.lifecycle.remove([], false, { tree: { ...this.tree, folders } });
    }
    const placements = new Map(Object.entries(this.tree.placements));
    for (const id of item.ids) {
      if (parentId === null) placements.delete(id);
      else placements.set(id, parentId);
    }
    return this.state.lifecycle.remove([], false, {
      tree: { ...this.tree, placements: Object.fromEntries(placements) },
      saveIds: item.ids,
    });
  }

  deleteFolder(id) {
    if (!this.folder(id)) return false;
    const { folders, sessions } = librarySubtree(this.tree, id);
    return this.state.lifecycle.remove(sessions, true, {
      tree: {
        ...this.tree,
        folders: this.tree.folders.filter((folder) => !folders.has(folder.id)),
      },
    });
  }
}
