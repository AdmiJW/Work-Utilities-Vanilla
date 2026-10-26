import { element, button, clear } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { copyText } from '../../file-transfer/public-api.js';
import { createResultGrid } from './result-grid.js';
import { renderStatementTable, renderDiagnostics } from './statement-tables.js';

export function createResultSheets(state, id, callbacks) {
  const doc = () => state.document(id);
  let selectedSheet = String(doc().options.selectedSheet ?? '');
  let result = null;
  let revision = -1;
  let renderedSheet = null;
  let grid = null;
  let dark = state.appearance.theme === 'dark';
  const tabs = element('div', {
    className: 'sheet-tabs',
    role: 'tablist',
    'aria-label': 'Result sheets',
    hidden: true,
  });
  const main = element(
    'div',
    { className: 'sheet-main' },
    element(
      'div',
      { className: 'analyzer-empty' },
      element('div', { className: 'empty-icon' }, icon('table', 29)),
      element('h2', {}, 'Turn output into something readable.'),
      element('p', {}, 'Open a TXT file or paste execution output, then analyze it locally.'),
    ),
  );
  function sheets() {
    const list = result.statements
      .filter((item) => item.kind === 'SELECT')
      .map((item) => ({
        id: String(item.index),
        name: `${item.index}. ${item.tableName}`,
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
    tabs.hidden = false;
    clear(
      tabs,
      list.map((sheet) =>
        button(
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
            'aria-selected': sheet.id === selectedSheet,
            className: sheet.id === selectedSheet ? 'active' : '',
          },
        ),
      ),
    );
    const key = `${revision}:${selectedSheet}`;
    if (renderedSheet === key) return;
    renderedSheet = key;
    grid?.dispose();
    grid = null;
    callbacks.changed();
    const selected = list.find((sheet) => sheet.id === selectedSheet);
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
    const statement = selected.statement;
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
    clear(main, header, host);
    if (statement.columns.length)
      grid = createResultGrid(
        host,
        statement,
        dark,
        doc().options.gridViews?.[selectedSheet],
        callbacks.selected,
        callbacks.inspect,
        (view) =>
          state.updateOptions(id, {
            gridViews: { ...doc().options.gridViews, [selectedSheet]: view },
          }),
      );
    else
      host.append(
        element(
          'p',
          { className: 'no-projection' },
          'Unsupported projection. Original rows are available in Diagnostics.',
        ),
      );
  }
  return {
    element: main,
    tabs,
    setResult(value, sourceRevision) {
      result = value;
      revision = sourceRevision;
      renderedSheet = null;
      render();
    },
    setTheme(value) {
      dark = value;
      grid?.setTheme(value);
    },
    dispose() {
      grid?.dispose();
    },
  };
}
