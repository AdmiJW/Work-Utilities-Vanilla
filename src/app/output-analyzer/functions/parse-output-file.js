import { getSqlStatementKind } from '../../sql-language/public-api.js';
import { readDelimitedProjection } from './read-delimited-projection.js';
import { splitResultRow } from './split-result-row.js';
function parseOutputFile(source, reportProgress) {
  const result = { statements: [], diagnostics: [], parsedRows: 0 };
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  let current = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (index % 1e3 === 0) reportProgress?.(Math.floor((index / lines.length) * 100));
    const header = /^SQL Statement Run:\s*(?:--(\d+)\s*)?(.*)$/.exec(line);
    if (header) {
      const sql = header[2] ?? '';
      let kind = 'UNKNOWN';
      try {
        kind = getSqlStatementKind(sql);
      } catch {
        // Malformed SQL is retained for diagnostics rather than discarded.
      }
      current = {
        index: result.statements.length + 1,
        marker: header[1] ?? '',
        sql,
        kind,
        tableName: 'Query',
        columns: [],
        rows: [],
        observedRows: 0,
        reportedRows: null,
        messages: [],
      };
      result.statements.push(current);
      if (kind === 'SELECT') {
        try {
          Object.assign(current, readDelimitedProjection(sql));
        } catch (error) {
          result.diagnostics.push({
            statementIndex: current.index,
            lineNumber,
            raw: line,
            message: error instanceof Error ? error.message : 'Unsupported SELECT projection.',
          });
        }
      }
      continue;
    }
    if (line === '') continue;
    if (!current) {
      result.diagnostics.push({
        statementIndex: null,
        lineNumber,
        raw: line,
        message: 'Content appears before the first SQL Statement Run prefix.',
      });
      continue;
    }
    const count = /^\s*\(?(\d+) rows? affected\)?\s*$/i.exec(line);
    if (count) {
      current.reportedRows = Number(count[1]);
      continue;
    }
    if (current.kind !== 'SELECT') {
      current.messages.push(line);
      continue;
    }
    current.observedRows++;
    if (current.columns.length === 0) {
      result.diagnostics.push({
        statementIndex: current.index,
        lineNumber,
        raw: line,
        message: 'Row retained as raw text because its SELECT projection is unsupported.',
      });
      continue;
    }
    const values = splitResultRow(line);
    if (values.length !== current.columns.length) {
      result.diagnostics.push({
        statementIndex: current.index,
        lineNumber,
        raw: line,
        message: `Expected ${current.columns.length} fields, found ${values.length}. An unescaped pipe or a NULL skipped by CONCAT_WS may have lost column boundaries.`,
      });
      continue;
    }
    current.rows.push({ lineNumber, values });
    result.parsedRows++;
  }
  for (const statement of result.statements) {
    if (
      statement.kind === 'SELECT' &&
      statement.reportedRows !== null &&
      statement.reportedRows !== statement.observedRows
    ) {
      result.diagnostics.push({
        statementIndex: statement.index,
        lineNumber: 0,
        raw: statement.sql,
        message: `Reported ${statement.reportedRows} rows but observed ${statement.observedRows} data lines.`,
      });
    }
  }
  reportProgress?.(100);
  return result;
}
export { parseOutputFile };
