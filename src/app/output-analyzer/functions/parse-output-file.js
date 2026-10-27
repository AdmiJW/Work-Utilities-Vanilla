import { getSqlStatementKind } from '../../sql-language/public-api.js';
import { readResultProjection } from './read-result-projection.js';
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
        tableName: null,
        columns: [],
        rows: [],
        observedRows: 0,
        reportedRows: null,
        messages: [],
      };
      result.statements.push(current);
      if (kind === 'SELECT') {
        try {
          Object.assign(current, readResultProjection(sql));
        } catch (error) {
          current.generic = true;
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
    const values = splitResultRow(line);
    if (current.generic) {
      while (current.columns.length < values.length) {
        const name = `Column ${current.columns.length + 1}`;
        current.columns.push({ name, expression: name });
      }
      current.rows.push({ lineNumber, values, raw: line });
      result.parsedRows++;
      continue;
    }
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
    if (statement.generic) {
      result.diagnostics.push({
        statementIndex: statement.index,
        lineNumber: 0,
        raw: statement.sql,
        message: statement.columns.length
          ? 'Column names could not be recovered. Generic headers were inferred from the widest data row.'
          : 'No data rows were returned, so column names and count could not be inferred.',
      });
      for (const row of statement.rows) {
        if (row.values.length !== statement.columns.length)
          result.diagnostics.push({
            statementIndex: statement.index,
            lineNumber: row.lineNumber,
            raw: row.raw,
            message: `Inferred ${statement.columns.length} columns but this row has ${row.values.length} fields. Absent trailing fields are displayed as empty.`,
          });
        while (row.values.length < statement.columns.length) row.values.push('');
        delete row.raw;
      }
    }
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
