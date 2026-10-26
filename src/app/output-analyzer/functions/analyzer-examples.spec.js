import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOutputFile } from './parse-output-file.js';
import { prepareWorkbookSheets } from './prepare-workbook-sheets.js';
import { readDelimitedProjection } from './read-delimited-projection.js';
describe('supplied analyzer examples and column provenance', () => {
  it.each([
    ['01_basic_results', 4, 6, 0],
    ['02_json_events', 3, 3, 0],
    ['03_patch_request_results', 12, 9, 0],
    ['04_wide_result', 1, 1, 0],
    ['05_many_rows_500', 1, 500, 0],
    ['06_join_results', 2, 3, 0],
    ['07_cte_results', 1, 2, 0],
    ['08_subquery_results', 1, 2, 0],
    ['09_concat_ws_results', 2, 3, 1],
  ])(
    'parses example %s and shares exact labels with the workbook',
    (file, statements, rows, diagnostics) => {
      const result = parseOutputFile(
        readFileSync(`examples/der-dpr-output analyzer/example_${file}.txt`, 'utf8'),
      );
      expect(result.statements).toHaveLength(statements);
      expect(result.parsedRows).toBe(rows);
      expect(result.diagnostics).toHaveLength(diagnostics);
      const selects = result.statements.filter((statement) => statement.kind === 'SELECT');
      const sheets = prepareWorkbookSheets(result);
      selects.forEach((statement, index) =>
        expect(sheets[index].rows[6]).toEqual(statement.columns.map((column) => column.name)),
      );
    },
  );
  it('retains qualified names, full wrappers/aggregates/subqueries and exposed aliases without mistaking CAST types for aliases', () => {
    const projection = readDelimitedProjection(
      "SELECT CONCAT_WS('|', d.EventId, [s].[Total], SUM(d.Amount), CAST(d.Id AS varchar(20)), (SELECT MAX(x.DateCreated) AS Latest FROM X x), d.EventId) AS Result FROM DeliveryAttempt d JOIN Summary s ON s.Id=d.Id",
    );
    expect(projection.columns.map((column) => column.name)).toEqual([
      'd.EventId',
      '[s].[Total]',
      'SUM(d.Amount)',
      'CAST(d.Id AS varchar(20))',
      'Latest',
      'd.EventId (2)',
    ]);
  });
});
