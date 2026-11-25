import { element, button, clear } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { copyText, downloadFile, sanitizeFileName } from '../../file-transfer/public-api.js';
import { createResultGrid } from './result-grid.js';
import { renderStatementTable, renderDiagnostics } from './statement-tables.js';
import { startInlineRename } from '../../shared/inline-rename.js';
import {
  resultSheetNames,
  statementKeys,
  sheetNameError,
} from '../functions/result-sheet-names.js';
import { resultSheetCsv, resultSheetMarkdown } from '../functions/export-result-sheet.js';
import { createTableSearch } from './table-search.js';
import { animateEnter, cancelMotion } from '../../shared/motion.js';
import { actionMenu } from '../../shared/ui.js';
import { resultRowColors } from '../../shared/result-row-colors.js';

const noHighlights = Object.freeze({});

export function createResultSheets(state, id, callbacks) {
  const doc = () => state.document(id);
  let selectedSheet = String(doc().options.selectedSheet ?? '');
  let result = null;
  let revision = -1;
  let renderedSheet = null;
  let grid = null;
  let searchView = null;
  let tabsSignature = '';
  let endRename;
  let statement = null;
  let selectedLine = null;
  const renameActions = new Map();
  const tabs = element('div', {
    className: 'sheet-tabs',
    role: 'tablist',
    'aria-label': 'Result sheets',
  });
  const more = actionMenu(
    'Sheet actions',
    () => [{ label: 'Rename result sheet', action: renameActions.get(selectedSheet) }],
    { className: 'tablet-action', hidden: true },
  );
  const strip = element(
    'div',
    { className: 'tab-strip result-tab-strip', hidden: true },
    tabs,
    more,
  );
  const nameError = element('p', {
    id: `sheet-name-error-${id}`,
    className: 'notice error sheet-name-error',
    role: 'alert',
    hidden: true,
  });
  const tabArea = element('div', { className: 'result-tab-area' }, strip, nameError);
  const fresh = () => !!result && doc().revision === revision;
  const colors = () =>
    fresh() && statement
      ? (doc().options.rowHighlights?.[statement.index] ?? noHighlights)
      : noHighlights;
  const highlight = actionMenu('Highlight row', () => [
    ...Object.entries(resultRowColors).map(([color, fill]) => ({
      label: element(
        'span',
        { className: 'row-highlight-option' },
        element('span', {
          className: 'row-highlight-swatch',
          style: `background-color: #${fill}`,
          'aria-hidden': 'true',
        }),
        color[0].toUpperCase() + color.slice(1),
      ),
      checked: colors()[selectedLine] === color,
      action: () => highlightRow(color),
    })),
    {
      label: 'Clear highlight',
      disabled: !colors()[selectedLine],
      action: () => highlightRow(null),
    },
  ]);
  const markdown = button('Download Markdown', () =>
    download('md', resultSheetMarkdown, 'text/markdown'),
  );
  const csv = button('Download CSV', () => download('csv', resultSheetCsv, 'text/csv'));
  const actions = element('div', { className: 'result-actions' }, highlight, markdown, csv);
  const main = element(
    'div',
    { className: 'sheet-main', id: `result-panel-${id}` },
    element(
      'div',
      { className: 'analyzer-empty' },
      element('div', { className: 'empty-icon' }, icon('table', 29)),
      element('h2', {}, 'No results yet'),
      element('p', {}, 'Open a TXT file or paste execution output, then select Analyze output.'),
    ),
  );

  function download(extension, serialize, mime) {
    if (!fresh() || !statement?.columns.length) return;
    const name = resultSheetNames(result.statements, doc().options.sheetNames).get(statement.index);
    downloadFile(
      serialize(statement),
      sanitizeFileName(`${state.fileName(id)}-${name}`, `.${extension}`),
      `${mime};charset=utf-8`,
    );
  }

  function highlightRow(color) {
    if (!fresh() || !statement || selectedLine === null) return;
    const rows = { ...colors() };
    if (color) rows[selectedLine] = color;
    else delete rows[selectedLine];
    const rowHighlights = { ...doc().options.rowHighlights };
    if (Object.keys(rows).length) rowHighlights[statement.index] = rows;
    else delete rowHighlights[statement.index];
    state.updateOptions(id, { rowHighlights });
  }

  function update() {
    more.disabled = !fresh();
    markdown.disabled = csv.disabled = !fresh() || !statement?.columns.length;
    highlight.disabled = !fresh() || selectedLine === null;
    highlight.title =
      selectedLine === null
        ? 'Select a data cell to highlight its row'
        : `Highlight the row at source line ${selectedLine}`;
    grid?.setHighlights(colors());
  }

  function selectCell(cell) {
    selectedLine = cell.rowNumber;
    callbacks.selected(cell);
    update();
  }
  function sheets() {
    const names = resultSheetNames(result.statements, doc().options.sheetNames);
    const list = result.statements
      .filter((item) => item.kind === 'SELECT')
      .map((item) => ({
        id: String(item.index),
        name: names.get(item.index),
        count: item.rows.length,
        statement: item,
      }));
    if (result.statements.some((item) => item.kind !== 'SELECT'))
      list.push({ id: 'statements', name: 'Statements' });
    if (result.diagnostics.length)
      list.push({ id: 'diagnostics', name: 'Diagnostics', count: result.diagnostics.length });
    return list;
  }
  function render() {
    const list = sheets();
    if (!list.some((sheet) => sheet.id === selectedSheet)) selectedSheet = list[0]?.id ?? '';
    strip.hidden = !list.length;
    const nextTabs = JSON.stringify(list.map(({ id, name, count }) => [id, name, count]));
    const activeSheet = document.activeElement?.dataset.sheetId;
    if (tabsSignature !== nextTabs) {
      endRename?.();
      renameActions.clear();
      clear(
        tabs,
        list.map((sheet, index) => {
          const tab = button(
            [
              sheet.name,
              sheet.count === undefined
                ? ''
                : element('span', { className: 'sheet-count' }, String(sheet.count)),
            ],
            () => {
              selectedSheet = sheet.id;
              state.updateOptions(id, { selectedSheet });
              render();
            },
            {
              role: 'tab',
              id: `result-tab-${id}-${sheet.id}`,
              'aria-controls': main.id,
              'aria-selected': sheet.id === selectedSheet,
              title: sheet.name,
              className: sheet.id === selectedSheet ? 'active' : '',
              dataset: { sheetId: sheet.id },
            },
          );
          if (sheet.statement) {
            const rename = () => {
              if (!fresh()) return;
              endRename?.();
              endRename = startInlineRename(
                tab,
                sheet.name,
                (name) => {
                  const key = statementKeys(result.statements).get(sheet.statement.index);
                  state.updateOptions(id, {
                    sheetNames: { ...doc().options.sheetNames, [key]: name },
                  });
                  render();
                },
                {
                  label: 'Result sheet name',
                  describedBy: nameError.id,
                  validate: (name) =>
                    sheetNameError(
                      name,
                      resultSheetNames(result.statements, doc().options.sheetNames),
                      sheet.statement.index,
                    ),
                  onError: (error) => {
                    nameError.textContent = error;
                    nameError.hidden = !error;
                  },
                  finished: () => {
                    endRename = null;
                  },
                },
              );
            };
            tab.addEventListener('dblclick', rename);
            renameActions.set(sheet.id, rename);
          }
          tab.addEventListener('keydown', (event) => {
            if (event.key === 'F2' && renameActions.has(sheet.id)) {
              event.preventDefault();
              renameActions.get(sheet.id)();
            }
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? list.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
            const target = tabs.children[next];
            target.focus();
            target.click();
          });
          return tab;
        }),
      );
    }
    tabsSignature = nextTabs;
    more.hidden = !renameActions.has(selectedSheet);
    let selectedTab;
    for (const tab of tabs.querySelectorAll('[data-sheet-id]')) {
      const active = tab.dataset.sheetId === selectedSheet;
      tab.setAttribute('aria-selected', String(active));
      tab.classList.toggle('active', active);
      tab.tabIndex = active ? 0 : -1;
      if (active) selectedTab = tab;
      if (tab.dataset.sheetId === activeSheet && document.activeElement === document.body)
        tab.focus({ preventScroll: true });
    }
    if (selectedTab) {
      main.setAttribute('role', 'tabpanel');
      main.setAttribute('aria-labelledby', selectedTab.id);
      selectedTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else {
      main.removeAttribute('role');
      main.removeAttribute('aria-labelledby');
    }
    const key = `${revision}:${selectedSheet}`;
    if (renderedSheet === key) return;
    renderedSheet = key;
    void animateEnter(main, { kind: 'view' });
    grid?.dispose();
    searchView?.dispose();
    searchView = null;
    grid = null;
    selectedLine = null;
    callbacks.changed();
    const selected = list.find((sheet) => sheet.id === selectedSheet);
    statement = selected?.statement ?? null;
    update();
    if (!selected) {
      clear(
        main,
        element(
          'p',
          { className: 'no-projection' },
          'No recognized statements. See the source and format documentation.',
        ),
      );
      return;
    }
    if (selected.id === 'statements') {
      clear(main, renderStatementTable(result.statements.filter((item) => item.kind !== 'SELECT')));
      return;
    }
    if (selected.id === 'diagnostics') {
      clear(main, renderDiagnostics(result.diagnostics));
      return;
    }
    const header = element(
      'div',
      { className: 'statement-info' },
      element(
        'div',
        { className: 'statement-label' },
        element('span', { className: 'eyebrow' }, 'SQL statement'),
        element(
          'span',
          { className: 'statement-counts' },
          `${statement.rows.length.toLocaleString()} parsed / ${statement.observedRows.toLocaleString()} observed rows · ${statement.columns.length} columns${statement.reportedRows === null ? '' : ` · ${statement.reportedRows} reported rows`}`,
        ),
        button('Copy', () => copyText(statement.sql), {
          className: 'copy-button',
          'aria-label': 'Copy SQL statement',
        }),
      ),
      element('pre', { className: 'sql-text mono' }, statement.sql),
    );
    const host = element('div', { className: 'grid-area' });
    const searchKey = statementKeys(result.statements).get(statement.index);
    searchView = createTableSearch(
      doc().options.tableSearches?.[searchKey] ?? '',
      statement.rows.length,
      (query) => grid?.setSearch(query),
      (query) => {
        state.updateOptions(id, {
          tableSearches: { ...doc().options.tableSearches, [searchKey]: query },
        });
      },
    );
    searchView.count(statement.rows.length);
    clear(
      main,
      header,
      element('div', { className: 'result-controls' }, searchView.element, actions),
      host,
    );
    if (statement.columns.length)
      grid = createResultGrid(
        host,
        statement,
        doc().options.gridViews?.[selectedSheet],
        selectCell,
        callbacks.inspect,
        (view) =>
          state.updateOptions(id, {
            gridViews: { ...doc().options.gridViews, [selectedSheet]: view },
          }),
        doc().options.tableSearches?.[searchKey] ?? '',
        (count) => searchView?.count(count),
        colors(),
      );
    else
      host.append(
        element(
          'p',
          { className: 'no-projection' },
          'No data rows were returned, so column names and count could not be inferred.',
        ),
      );
  }
  return {
    element: main,
    tabs: tabArea,
    update,
    setResult(value, sourceRevision) {
      result = value;
      revision = sourceRevision;
      renderedSheet = null;
      render();
    },
    dispose() {
      endRename?.();
      cancelMotion(main);
      grid?.dispose();
      searchView?.dispose();
    },
  };
}
