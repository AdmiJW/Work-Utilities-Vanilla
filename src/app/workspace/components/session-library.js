import { element, button, clear, subscribeTo } from '../../shared/dom.js';
import { openDialog, confirmAction, closeDialog } from '../../shared/dialog.js';
import { icon } from '../../shared/icons.js';
import { tools } from '../../shared/tool-details.js';
import { libraryFolderId, libraryPath, librarySubtree } from '../../sessions/public-api.js';

const root = { id: null, name: 'Library root' };
const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

function breadcrumbs(host, tree, location, navigate, drop = (node) => node) {
  clear(
    host,
    [root, ...libraryPath(tree, location)].map(({ id, name }) =>
      drop(
        button(name, () => navigate(id), {
          title: name,
          'aria-current': id === location ? 'location' : undefined,
          dataset: { location: id ?? '' },
        }),
        id,
      ),
    ),
  );
}

function editFolder(state, parentId, folder) {
  const input = element('input', {
    value: folder?.name ?? '',
    'aria-label': 'Folder name',
    maxLength: 200,
  });
  const error = element('p', { className: 'notice error', role: 'alert', hidden: true });
  let saving = false;
  const submit = async (close) => {
    if (saving) return;
    const problem = state.library.nameError(parentId, input.value, folder?.id);
    error.textContent = problem;
    error.hidden = !problem;
    input.setAttribute('aria-invalid', String(!!problem));
    if (problem) return input.focus();
    saving = true;
    if (await state.library.saveFolder(parentId, input.value, folder?.id)) void close();
    else {
      error.textContent = state.error || 'The folder could not be saved.';
      error.hidden = false;
    }
    saving = false;
  };
  const dialog = openDialog(
    folder ? 'Rename folder' : 'New folder',
    element('div', {}, input, error),
    [
      { label: 'Cancel', action: (close) => close() },
      { label: folder ? 'Rename' : 'Create folder', action: submit, primary: true },
    ],
  );
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void submit(() => closeDialog(dialog));
  });
  input.focus();
  input.select();
}

function openMovePicker(state, item, moved) {
  const { library } = state;
  const { tree } = library;
  const movingFolder = library.folder(item.folderId);
  const excluded = movingFolder ? librarySubtree(tree, movingFolder.id).folders : new Set();
  const paths = item.ids?.map((id) => libraryPath(tree, libraryFolderId(tree, id))) ?? [];
  const common = paths[0]?.filter((folder, index) =>
    paths.every((path) => path[index]?.id === folder.id),
  );
  let location = movingFolder?.parentId ?? common?.at(-1)?.id ?? null;
  let saving = false;
  const trail = element('nav', { className: 'library-trail', 'aria-label': 'Destination path' });
  const list = element('div', { className: 'move-folders' });
  const error = element('p', { className: 'notice error', role: 'alert', hidden: true });
  const dialog = openDialog('Move to folder', element('div', {}, trail, list, error), [
    { label: 'Cancel', action: (close) => close() },
    {
      label: 'Move here',
      primary: true,
      action: async (close) => {
        if (saving) return;
        saving = true;
        move.disabled = true;
        if (await library.move(item, location)) {
          moved();
          void close();
        } else {
          saving = false;
          update(
            state.error || library.moveError(item, location) || 'The item could not be moved.',
          );
        }
      },
    },
  ]);
  const move = dialog.querySelector('footer button:last-child');
  function navigate(id) {
    if (saving) return;
    location = id;
    update();
    trail.lastElementChild?.focus();
  }
  function update(failure) {
    breadcrumbs(trail, library.tree, location, navigate);
    const folders = library.tree.folders
      .filter(({ id, parentId }) => parentId === location && !excluded.has(id))
      .toSorted(byName);
    clear(
      list,
      folders.length
        ? folders.map(({ id, name }) =>
            button([icon('library'), name], () => navigate(id), {
              title: name,
              'aria-label': `Open folder ${name}`,
            }),
          )
        : element('p', { className: 'hint' }, 'No subfolders here.'),
    );
    const problem = library.moveError(item, location);
    const unavailable = movingFolder
      ? movingFolder.parentId === location
      : item.ids.every((id) => libraryFolderId(library.tree, id) === location);
    move.disabled = !!problem;
    error.textContent = failure ?? (unavailable ? '' : problem);
    error.hidden = !error.textContent;
  }
  update();
  trail.lastElementChild?.focus();
}

export function openSessionLibrary(state) {
  const selected = new Set();
  const { library } = state;
  let location = null;
  let dragged = null;
  let signature = '';
  const search = element('input', {
    type: 'search',
    placeholder: 'Find a saved session or folder…',
    'aria-label': 'Find a saved session',
  });
  const trail = element('nav', { className: 'library-trail', 'aria-label': 'Library path' });
  const rows = element('div', { className: 'saved-sessions' });
  const error = element('p', { className: 'notice error', role: 'alert', hidden: true });
  const all = element('input', { type: 'checkbox', 'aria-label': 'Select all' });
  const create = button('New folder', () => editFolder(state, location));
  const moveSelection = button('Move selected (0)', () => move({ ids: [...selected] }));
  const deleteSelection = button('Delete selected (0)', () => remove([...selected]));
  const sortDate = button('Date', () => state.setAppearance({ librarySort: 'date' }));
  const sortName = button('Name', () => state.setAppearance({ librarySort: 'name' }));
  const dialog = openDialog(
    'Session library',
    element(
      'div',
      {},
      element('div', { className: 'library-toolbar' }, search, sortDate, sortName),
      element('div', { className: 'library-navigation' }, trail, create),
      element(
        'div',
        { className: 'library-selection' },
        element('label', {}, all, 'Select all'),
        element('div', { className: 'library-item-actions' }, moveSelection, deleteSelection),
      ),
      error,
      rows,
    ),
    [],
    { className: 'session-library-dialog' },
  );
  const query = () => search.value.trim().toLowerCase();
  const matches = (name, parentId) =>
    query() ? name.toLowerCase().includes(query()) : parentId === location;
  const sessions = () =>
    state.savedSessions
      .filter((item) => matches(item.name, libraryFolderId(library.tree, item.id)))
      .toSorted(
        state.appearance.librarySort === 'name'
          ? byName
          : (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      );
  const pathText = (id) =>
    [root, ...libraryPath(library.tree, id)].map(({ name }) => name).join(' / ');
  const folderCount = (ids) =>
    state.savedSessions.filter(({ id, isOpen }) => isOpen && ids.includes(id)).length;
  function navigate(id) {
    location = id;
    search.value = '';
    selected.clear();
    update();
    trail.lastElementChild?.focus();
  }
  function move(item) {
    openMovePicker(state, item, () => {
      selected.clear();
      update();
    });
  }
  async function remove(ids) {
    if (
      !ids.length ||
      !(await confirmAction(
        'Delete saved sessions?',
        `Delete ${ids.length} saved session(s) permanently? ${folderCount(ids)} open tab(s) will also close.`,
        'Delete sessions',
      ))
    )
      return;
    if (await state.deleteMany(ids)) {
      selected.clear();
      update();
    }
  }
  async function removeFolder(folder) {
    const { folders, sessions } = librarySubtree(library.tree, folder.id);
    if (
      await confirmAction(
        'Delete folder and contents?',
        `Permanently delete “${folder.name}” and all its contents? This deletes ${folders.size} folder(s) and ${sessions.length} saved session(s). ${folderCount(sessions)} open tab(s) will also close.`,
        'Delete folder',
      )
    )
      await library.deleteFolder(folder.id);
  }
  function drag(node, item) {
    node.draggable = true;
    node.addEventListener('dragstart', (event) => {
      if (state.busy) return event.preventDefault();
      dragged = item;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-work-utilities-library', 'item');
      node.classList.add('library-dragging');
    });
    node.addEventListener('dragend', () => {
      dragged = null;
      node.classList.remove('library-dragging');
      dialog
        .querySelectorAll('.library-drop-target')
        .forEach((target) => target.classList.remove('library-drop-target'));
    });
    return node;
  }
  function drop(node, destination) {
    node.addEventListener('dragover', (event) => {
      if (!dragged || state.busy || library.moveError(dragged, destination)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      node.classList.add('library-drop-target');
    });
    node.addEventListener('dragleave', (event) => {
      if (!node.contains(event.relatedTarget)) node.classList.remove('library-drop-target');
    });
    node.addEventListener('drop', async (event) => {
      node.classList.remove('library-drop-target');
      if (!dragged || state.busy || library.moveError(dragged, destination)) return;
      event.preventDefault();
      const item = dragged;
      dragged = null;
      if (await library.move(item, destination)) {
        selected.clear();
        update();
      }
    });
    return node;
  }
  function action(label, name, key, run) {
    return button(label, run, {
      'aria-label': `${label} ${name}`,
      disabled: state.busy,
      dataset: { focus: key },
    });
  }
  function folderRow(folder) {
    const { id, name, parentId } = folder;
    return drop(
      drag(
        element(
          'div',
          { className: 'library-folder' },
          button(
            [
              icon('library'),
              element(
                'span',
                { className: 'saved-details' },
                element('strong', { title: name }, name),
                query() ? element('small', {}, pathText(parentId)) : null,
              ),
            ],
            () => navigate(id),
            {
              className: 'saved-open',
              'aria-label': `Open folder ${name}`,
              dataset: { focus: `open-${id}` },
            },
          ),
          element(
            'div',
            { className: 'library-item-actions' },
            action('Rename', name, `rename-${id}`, () => editFolder(state, parentId, folder)),
            action('Move', name, `move-${id}`, () => move({ folderId: id })),
            action('Delete', name, `delete-${id}`, () => removeFolder(folder)),
          ),
        ),
        { folderId: id },
      ),
      id,
    );
  }
  function sessionRow(session) {
    const { id, name, toolId, updatedAt, isOpen } = session;
    const checkbox = element('input', {
      type: 'checkbox',
      checked: selected.has(id),
      'aria-label': `Select ${name}`,
      dataset: { focus: `select-${id}` },
    });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(id);
      else selected.delete(id);
      update();
    });
    return drag(
      element(
        'div',
        { className: 'saved-session' },
        checkbox,
        button(
          [
            icon(tools[toolId].icon),
            element(
              'span',
              { className: 'saved-details' },
              element('strong', { title: name }, name),
              element(
                'small',
                {},
                `${tools[toolId].title} · ${new Date(updatedAt).toLocaleString()}`,
              ),
              query() ? element('small', {}, pathText(libraryFolderId(library.tree, id))) : null,
            ),
          ],
          async () => {
            if (await state.activate(id)) void closeDialog(dialog);
          },
          {
            className: 'saved-open',
            disabled: state.busy || state.openingId !== null,
            'aria-label': `Reopen ${name}`,
            dataset: { focus: `open-${id}` },
          },
        ),
        element('span', { className: 'session-chip' }, isOpen ? 'Open' : 'Closed'),
        element(
          'div',
          { className: 'library-item-actions' },
          action('Move', name, `move-${id}`, () => move({ ids: [id] })),
          action('Delete', name, `delete-${id}`, () => remove([id])),
        ),
      ),
      { ids: [id] },
    );
  }
  function update() {
    if (location !== null && !library.folder(location)) location = null;
    const items = sessions();
    const visibleIds = new Set(items.map(({ id }) => id));
    for (const id of selected) if (!visibleIds.has(id)) selected.delete(id);
    const sort = state.appearance.librarySort;
    sortDate.setAttribute('aria-pressed', String(sort !== 'name'));
    sortName.setAttribute('aria-pressed', String(sort === 'name'));
    all.checked = items.length > 0 && items.every(({ id }) => selected.has(id));
    all.indeterminate = !all.checked && selected.size > 0;
    all.disabled = items.length === 0 || state.busy;
    create.disabled = state.busy;
    moveSelection.textContent = `Move selected (${selected.size})`;
    deleteSelection.textContent = `Delete selected (${selected.size})`;
    moveSelection.disabled = deleteSelection.disabled = selected.size === 0 || state.busy;
    error.textContent = state.openingError || state.error;
    error.hidden = !error.textContent;
    const next = JSON.stringify([
      library.tree,
      location,
      query(),
      items,
      [...selected],
      state.busy,
      state.openingId,
    ]);
    if (next === signature) return;
    signature = next;
    const focus = rows.contains(document.activeElement)
      ? document.activeElement.dataset.focus
      : null;
    const breadcrumbFocus = trail.contains(document.activeElement)
      ? document.activeElement.dataset.location
      : null;
    breadcrumbs(trail, library.tree, location, navigate, drop);
    const folders = library.tree.folders
      .filter(({ name, parentId }) => matches(name, parentId))
      .toSorted(byName);
    clear(
      rows,
      folders.map(folderRow),
      items.map(sessionRow),
      !folders.length && !items.length
        ? element(
            'p',
            { className: 'hint' },
            query() ? 'No matching sessions.' : 'This folder is empty.',
          )
        : null,
    );
    if (focus)
      [...rows.querySelectorAll('[data-focus]')]
        .find((node) => node.dataset.focus === focus)
        ?.focus({ preventScroll: true });
    if (breadcrumbFocus !== null)
      [...trail.children]
        .find((node) => node.dataset.location === breadcrumbFocus)
        ?.focus({ preventScroll: true });
  }
  all.addEventListener('change', () => {
    if (all.checked) for (const item of sessions()) selected.add(item.id);
    else selected.clear();
    update();
  });
  search.addEventListener('input', () => {
    selected.clear();
    update();
  });
  const unsubscribe = subscribeTo(state, update);
  dialog.addEventListener('close', unsubscribe, { once: true });
  update();
  return dialog;
}
