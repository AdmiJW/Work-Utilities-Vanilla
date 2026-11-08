import { EditorView, keymap, panels, runScopeHandlers } from '@codemirror/view';
import {
  search,
  SearchQuery,
  getSearchQuery,
  setSearchQuery,
  openSearchPanel,
  closeSearchPanel,
  searchPanelOpen,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search';
import { element, button } from '../../shared/dom.js';

export function createMarkdownSearch(owner, host, changed = () => {}) {
  const overlay = element('div', { className: 'md-find-overlay' });
  host.append(overlay);
  let panel = null,
    expanded = false,
    alive = true;
  const close = () => {
    const view = owner.outer;
    if (!searchPanelOpen(view.state)) return false;
    closeSearchPanel(view);
    queueMicrotask(() => {
      if (!alive || searchPanelOpen(view.state)) return;
      const range = view.state.selection.main;
      if (owner.mode === 'live')
        for (const table of owner.tables)
          for (let r = 0; r < table.model.rows.length; r++)
            for (let c = 0; c < table.model.columns; c++) {
              const cell = table.model.rows[r].cells[c];
              if (cell && range.from >= cell.from && range.to <= cell.to) {
                table.edit(r, c, {
                  selection: { anchor: range.anchor - cell.from, head: range.head - cell.from },
                });
                return;
              }
            }
      owner.activeTable?.leave(false);
      view.focus();
    });
    return true;
  };
  const open = ({ replace = false, seed = true } = {}) => {
    const view = owner.outer,
      query = getSearchQuery(view.state),
      selection = view.state.selection.main;
    const text =
      selection.to - selection.from <= 100 ? view.state.sliceDoc(selection.from, selection.to) : '';
    const maySeed =
      seed &&
      text &&
      !text.includes('\n') &&
      !text.startsWith('![') &&
      !text.includes('data:image/');
    if (replace) expanded = true;
    openSearchPanel(view);
    if (!maySeed && !getSearchQuery(view.state).eq(query))
      view.dispatch({ effects: setSearchQuery.of(query) });
    panel?.showReplace();
    panel?.find.focus();
    panel?.find.select();
    return true;
  };
  const bindings = [
    { key: 'Mod-f', run: () => open(), scope: 'editor search-panel' },
    { key: 'Mod-h', run: () => open({ replace: true }), scope: 'editor search-panel' },
    { key: 'Escape', run: close, scope: 'editor search-panel' },
  ];

  function createPanel(view) {
    const query = getSearchQuery(view.state);
    const find = element('input', {
      value: query.search,
      placeholder: 'Find',
      'aria-label': 'Find',
      'main-field': 'true',
      spellcheck: false,
      autocomplete: 'off',
    });
    const replacement = element('input', {
      value: query.replace,
      placeholder: 'Replace',
      'aria-label': 'Replace',
      spellcheck: false,
      autocomplete: 'off',
    });
    const count = element('span', {
      className: 'md-find-count',
      role: 'status',
      'aria-live': 'polite',
    });
    const flags = {
      caseSensitive: query.caseSensitive,
      wholeWord: query.wholeWord,
      regexp: query.regexp,
    };
    const commit = () => {
      const next = new SearchQuery({ search: find.value, replace: replacement.value, ...flags });
      if (!next.eq(getSearchQuery(view.state))) view.dispatch({ effects: setSearchQuery.of(next) });
    };
    find.addEventListener('input', commit);
    replacement.addEventListener('input', commit);
    const control = (label, text, action) => {
      const node = button(text, action, { 'aria-label': label, title: label });
      node.addEventListener('mousedown', (event) => event.preventDefault());
      return node;
    };
    const toggle = control('Toggle Replace', '›', () => {
      expanded = !expanded;
      current.showReplace();
    });
    const previous = control('Previous match', '↑', () => findPrevious(view));
    const next = control('Next match', '↓', () => findNext(view));
    const flagButtons = Object.entries({
      caseSensitive: ['Match case', 'Aa'],
      wholeWord: ['Whole word', 'ab'],
      regexp: ['Use regular expression', '.*'],
    }).map(([key, [label, text]]) => {
      const node = control(label, text, () => {
        flags[key] = !flags[key];
        commit();
      });
      node.dataset.flag = key;
      return node;
    });
    const replace = control('Replace', 'Replace', () => replaceNext(view));
    const all = control('Replace All', 'All', () => replaceAll(view));
    const replaceRow = element('div', { className: 'md-replace-row' }, replacement, replace, all);
    const dom = element(
      'div',
      { className: 'md-find-widget', role: 'search', 'aria-label': 'Find in Markdown' },
      element(
        'div',
        { className: 'md-find-row' },
        toggle,
        find,
        ...flagButtons,
        count,
        previous,
        next,
        control('Close Find', '×', close),
      ),
      replaceRow,
    );
    let timer,
      token = 0,
      matches = [],
      capped = false,
      complete = false;
    const display = () => {
      const q = getSearchQuery(view.state),
        selection = view.state.selection.main;
      const invalid = !!q.search && !q.valid;
      find.setAttribute('aria-invalid', String(invalid));
      dom.classList.toggle(
        'md-find-error',
        invalid || (complete && matches.length === 0 && q.valid),
      );
      for (const node of flagButtons)
        node.setAttribute('aria-pressed', String(flags[node.dataset.flag]));
      previous.disabled = next.disabled = !q.valid || (complete && matches.length === 0);
      replace.disabled = all.disabled =
        view.state.readOnly || !q.valid || (complete && matches.length === 0);
      if (invalid) count.textContent = 'Invalid regex';
      else if (!q.search) count.textContent = '';
      else if (!complete) count.textContent = 'Searching…';
      else if (!matches.length) count.textContent = 'No results';
      else if (capped) count.textContent = '1,000+ matches';
      else {
        const index = matches.findIndex(
          (match) => match.from === selection.from && match.to === selection.to,
        );
        count.textContent =
          index < 0 ? `${matches.length} matches` : `${index + 1} of ${matches.length}`;
      }
    };
    const recount = () => {
      clearTimeout(timer);
      const job = ++token;
      matches = [];
      capped = false;
      complete = false;
      display();
      const q = getSearchQuery(view.state),
        state = view.state;
      if (!q.valid) {
        complete = true;
        display();
        return;
      }
      timer = setTimeout(() => {
        const cursor = q.getCursor(state);
        const batch = () => {
          if (job !== token || !alive) return;
          for (let i = 0; i < 100; i++) {
            const item = cursor.next();
            if (item.done) {
              complete = true;
              display();
              return;
            }
            if (matches.length === 1000) {
              capped = true;
              complete = true;
              display();
              return;
            }
            matches.push({ from: item.value.from, to: item.value.to });
          }
          timer = setTimeout(batch, 0);
        };
        batch();
      }, 90);
    };
    const current = {
      dom,
      top: true,
      find,
      showReplace() {
        replaceRow.hidden = view.state.readOnly || !expanded;
        toggle.hidden = view.state.readOnly;
        toggle.setAttribute('aria-expanded', String(!replaceRow.hidden));
        toggle.classList.toggle('expanded', !replaceRow.hidden);
      },
      mount() {
        find.focus();
        find.select();
      },
      update(update) {
        const nextQuery = getSearchQuery(update.state),
          old = getSearchQuery(update.startState);
        if (!old.eq(nextQuery)) {
          if (find.value !== nextQuery.search) find.value = nextQuery.search;
          if (replacement.value !== nextQuery.replace) replacement.value = nextQuery.replace;
          for (const key of Object.keys(flags)) flags[key] = nextQuery[key];
        }
        if (update.docChanged || !old.eq(nextQuery)) recount();
        else display();
        current.showReplace();
      },
      destroy() {
        clearTimeout(timer);
        token++;
        if (panel === current) panel = null;
      },
    };
    dom.addEventListener('keydown', (event) => {
      if (runScopeHandlers(view, event, 'search-panel')) event.preventDefault();
      else if (event.key === 'Enter') {
        event.preventDefault();
        if (event.target === replacement) replaceNext(view);
        else (event.shiftKey ? findPrevious : findNext)(view);
      }
    });
    panel = current;
    current.showReplace();
    recount();
    return current;
  }
  return {
    extension: [
      panels({ topContainer: overlay }),
      search({
        top: true,
        createPanel,
        scrollToMatch: (range) => EditorView.scrollIntoView(range, { y: 'center' }),
      }),
      keymap.of(bindings),
      EditorView.updateListener.of((update) => changed(searchPanelOpen(update.state))),
    ],
    open,
    close,
    toggle() {
      return searchPanelOpen(owner.outer.state) ? close() : open({ seed: false });
    },
    dispose() {
      alive = false;
      closeSearchPanel(owner.outer);
      overlay.remove();
    },
  };
}
