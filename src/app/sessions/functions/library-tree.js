export const emptyLibrary = () => ({ folders: [], placements: {} });
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const nameKey = (name) => name.toUpperCase();

export function libraryFolderNameError(tree, parentId, name, exceptId) {
  if (!name.trim() || name.length > 200) return 'Enter a folder name between 1 and 200 characters.';
  if (
    tree.folders.some(
      (folder) =>
        folder.parentId === parentId &&
        folder.id !== exceptId &&
        nameKey(folder.name) === nameKey(name),
    )
  )
    return 'A folder with that name already exists here.';
  return '';
}

export function libraryPath(tree, folderId) {
  const path = [];
  let folder = tree.folders.find((item) => item.id === folderId);
  while (folder) {
    path.unshift(folder);
    folder = tree.folders.find((item) => item.id === folder.parentId);
  }
  return path;
}

export function libraryFolderId(tree, sessionId) {
  return Object.hasOwn(tree.placements, sessionId) ? tree.placements[sessionId] : null;
}

export function librarySubtree(tree, folderId) {
  const folders = new Set([folderId]);
  const children = Map.groupBy(tree.folders, (folder) => folder.parentId);
  for (const id of folders) for (const folder of children.get(id) ?? []) folders.add(folder.id);
  const sessions = Object.entries(tree.placements)
    .filter(([, parentId]) => folders.has(parentId))
    .map(([id]) => id);
  return { folders, sessions };
}

export function validLibrary(tree, sessionIds) {
  if (!isRecord(tree) || !Array.isArray(tree.folders) || !isRecord(tree.placements)) return false;
  const parents = new Map(),
    names = new Map();
  for (const folder of tree.folders) {
    if (
      !isRecord(folder) ||
      typeof folder.id !== 'string' ||
      !idPattern.test(folder.id) ||
      parents.has(folder.id) ||
      (folder.parentId !== null && typeof folder.parentId !== 'string') ||
      typeof folder.name !== 'string' ||
      !folder.name.trim() ||
      folder.name !== folder.name.trim() ||
      folder.name.length > 200
    )
      return false;
    parents.set(folder.id, folder.parentId);
    const siblings = names.get(folder.parentId) ?? new Set();
    const name = nameKey(folder.name);
    if (siblings.has(name)) return false;
    siblings.add(name);
    names.set(folder.parentId, siblings);
  }
  const checked = new Set([null]);
  for (const folder of tree.folders) {
    let id = folder.id;
    const path = new Set();
    while (!checked.has(id)) {
      if (!parents.has(id) || path.has(id)) return false;
      path.add(id);
      id = parents.get(id);
    }
    for (const ancestor of path) checked.add(ancestor);
  }
  return Object.entries(tree.placements).every(
    ([sessionId, folderId]) => sessionIds.has(sessionId) && parents.has(folderId),
  );
}
