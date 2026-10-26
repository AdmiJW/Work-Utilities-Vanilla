import { element, button } from '../../shared/dom.js';
import { copyText } from '../../file-transfer/public-api.js';

export function renderStatementTable(statements) {
  return element(
    'div',
    { className: 'summary-scroll' },
    element(
      'table',
      { className: 'summary-table', 'aria-label': 'Executed statements' },
      element(
        'thead',
        {},
        element(
          'tr',
          {},
          ['Statement', 'Kind', 'SQL', 'Reported rows', 'Messages'].map((name) =>
            element('th', {}, name),
          ),
        ),
      ),
      element(
        'tbody',
        {},
        statements.map((statement) =>
          element(
            'tr',
            {},
            element('td', {}, String(statement.index)),
            element('td', {}, statement.kind),
            element('td', { className: 'mono sql-summary' }, statement.sql),
            element(
              'td',
              {},
              statement.reportedRows === null
                ? 'Not reported'
                : `${statement.reportedRows} rows affected`,
            ),
            element('td', {}, statement.messages.join('\n')),
          ),
        ),
      ),
    ),
  );
}

export function renderDiagnostics(diagnostics) {
  const headers = element(
    'thead',
    {},
    element(
      'tr',
      {},
      ['Statement', 'Source line', 'Reason', 'Raw text'].map((name) => element('th', {}, name)),
    ),
  );
  const rows = diagnostics.map((item) =>
    element(
      'tr',
      {},
      element('td', {}, String(item.statementIndex ?? '—')),
      element('td', {}, String(item.lineNumber)),
      element('td', {}, item.message),
      element(
        'td',
        { className: 'mono raw-diagnostic' },
        item.raw,
        button('Copy', () => copyText(item.raw)),
      ),
    ),
  );
  return element(
    'div',
    { className: 'summary-scroll' },
    element(
      'table',
      { className: 'summary-table', 'aria-label': 'Output diagnostics' },
      headers,
      element('tbody', {}, rows),
    ),
  );
}
