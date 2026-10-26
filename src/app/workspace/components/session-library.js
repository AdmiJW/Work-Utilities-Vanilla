import { element, button, clear, subscribeTo } from '../../shared/dom.js';
import { openDialog, confirmAction } from '../../shared/dialog.js';

export function openSessionLibrary(state) {
  const selected = new Set();
  const search = element('input', {
    type: 'search',
    placeholder: 'Find a saved session…',
    'aria-label': 'Find a saved session',
  });
  const rows = element('div', { className: 'saved-sessions' });
  const error = element('p', { className: 'notice error', role: 'alert', hidden: true });
  const all = element('input', { type: 'checkbox', 'aria-label': 'Select all' });
  const deleteSelection = button('Delete selected (0)', () => remove([...selected]));
  const sortDate = button('Date', () => state.setAppearance({ librarySort: 'date' }));
  const sortName = button('Name', () => state.setAppearance({ librarySort: 'name' }));
  const dialog = openDialog(
    'Session library',
    element(
      'div',
      {},
      element('div', { className: 'library-toolbar' }, search, sortDate, sortName),
      element(
        'div',
        { className: 'library-selection' },
        element('label', {}, all, 'Select all'),
        deleteSelection,
      ),
      error,
      rows,
      element(
        'p',
        { className: 'hint' },
        'Closing a tab keeps its saved session here. Deleting removes its saved content.',
      ),
    ),
  );
  function matches() {
    const items = state.summaries.filter((item) =>
      item.name.toLowerCase().includes(search.value.trim().toLowerCase()),
    );
    return items.toSorted(
      state.appearance.librarySort === 'name'
        ? (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        : (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
    );
  }
  async function remove(ids) {
    if (!ids.length) return;
    const openCount = state.summaries.filter((item) => ids.includes(item.id) && item.isOpen).length;
    if (
      !(await confirmAction(
        'Delete saved sessions?',
        `Delete ${ids.length} saved session(s) permanently? ${openCount} open tab(s) will also close.`,
        'Delete sessions',
      ))
    )
      return;
    if (await state.deleteMany(ids)) {
      selected.clear();
      update();
    }
  }
  function update() {
    const items = matches();
    sortDate.setAttribute('aria-pressed', String(state.appearance.librarySort !== 'name'));
    sortName.setAttribute('aria-pressed', String(state.appearance.librarySort === 'name'));
    all.checked = items.length > 0 && items.every((item) => selected.has(item.id));
    all.indeterminate = !all.checked && items.some((item) => selected.has(item.id));
    all.disabled = items.length === 0;
    deleteSelection.textContent = `Delete selected (${selected.size})`;
    deleteSelection.disabled = selected.size === 0 || state.busy;
    error.hidden = !state.openingError;
    error.textContent = state.openingError;
    clear(
      rows,
      items.length
        ? items.map((session) => {
            const checkbox = element('input', {
              type: 'checkbox',
              checked: selected.has(session.id),
              'aria-label': `Select ${session.name}`,
            });
            checkbox.addEventListener('change', () => {
              if (checkbox.checked) selected.add(session.id);
              else selected.delete(session.id);
              update();
            });
            return element(
              'div',
              { className: 'saved-session' },
              checkbox,
              button(
                element(
                  'span',
                  { className: 'saved-details' },
                  element('strong', {}, session.name),
                  element(
                    'small',
                    {},
                    `${session.toolId === 'sql-formatter' ? 'SQL Formatter' : 'Output Analyzer'} · ${new Date(session.updatedAt).toLocaleString()}`,
                  ),
                ),
                async () => {
                  if (await state.activate(session.id)) dialog.close();
                },
                {
                  className: 'saved-open',
                  disabled: state.openingId !== null,
                  'aria-label': `Reopen ${session.name}`,
                },
              ),
              element('span', { className: 'session-chip' }, session.isOpen ? 'Open' : 'Closed'),
              button('Delete', () => remove([session.id]), {
                'aria-label': `Delete ${session.name}`,
                disabled: state.busy,
              }),
            );
          })
        : element('p', { className: 'hint' }, 'No matching sessions.'),
    );
  }
  all.addEventListener('change', () => {
    if (all.checked) for (const item of matches()) selected.add(item.id);
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
