import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { readResultProjection } from './read-result-projection.js';
import { parseOutputFile } from './parse-output-file.js';
import { matchesTableSearch } from './matches-table-search.js';
import { resultSheetNames, statementKeys } from './result-sheet-names.js';
import { prepareWorkbookSheets } from './prepare-workbook-sheets.js';
import { writeExcelWorkbook } from '../adapters/write-excel-workbook.js';

describe('additional result projections', () => {
  it('recovers lists, aliases, nested commas, TOP, CTEs and complex expressions', () => {
    const value = readResultProjection(
      "WITH c AS (SELECT 1 AS Id) SELECT DISTINCT TOP (10) PERCENT WITH TIES c.Id, COALESCE(c.Name, 'a,b') AS Label, COUNT(*) Total, a * b FROM c",
    );
    expect(value.generic).toBe(false);
    expect(value.columns.map((column) => column.name)).toEqual(['c.Id', 'Label', 'Total', 'a * b']);
    expect(value.tableName).toBe('c');
  });
  it.each([
    'SELECT * FROM T',
    'SELECT t.* FROM dbo.T t',
    'SELECT x, t.* FROM T t',
    "SELECT CONCAT_WS(',',a,b) FROM T",
  ])('falls back for %s', (sql) => expect(readResultProjection(sql).generic).toBe(true));
  it('keeps all generic rows and exact values, padding absent fields and preserving raw diagnostics', () => {
    const result = parseOutputFile(
      'SQL Statement Run: --1SELECT * FROM T;\n 001 |{"note":"a|b"}\n002|x|tail\n003',
    );
    expect(result.parsedRows).toBe(3);
    expect(result.statements[0].columns.map((column) => column.name)).toEqual([
      'Column 1',
      'Column 2',
      'Column 3',
    ]);
    expect(result.statements[0].rows.map((row) => row.values)).toEqual([
      [' 001 ', '{"note":"a|b"}', ''],
      ['002', 'x', 'tail'],
      ['003', '', ''],
    ]);
    expect(result.diagnostics.some((item) => item.raw === '003')).toBe(true);
  });
  it('retains known-projection mismatches and does not fabricate unknown zero-row columns', () => {
    const result = parseOutputFile(
      'SQL Statement Run: --1SELECT a,b FROM T;\nonly one\nSQL Statement Run: --1SELECT * FROM T;\n0 rows affected',
    );
    expect(result.statements[0].rows).toEqual([]);
    expect(result.diagnostics.some((item) => item.raw === 'only one')).toBe(true);
    expect(result.statements[1].columns).toEqual([]);
  });
});

describe('search and result labels', () => {
  it('matches a literal case-insensitive phrase within a single data cell', () => {
    expect(matchesTableSearch(['box', 'fragile'], 'box fragile')).toBe(false);
    expect(matchesTableSearch(['{"note":"Box | fragile"}', '0001'], 'box | FRAGILE')).toBe(true);
    expect(matchesTableSearch(['0001'], '001')).toBe(true);
    expect(matchesTableSearch(['a.b'], 'a.b')).toBe(true);
    expect(matchesTableSearch(['axb'], 'a.b')).toBe(false);
    expect(matchesTableSearch(['x'], '')).toBe(true);
  });
  it('assigns defaults and carries custom labels by unchanged SQL and repeated occurrence', () => {
    const statements = parseOutputFile(
      'SQL Statement Run: --1SELECT a FROM T;\nx\nSQL Statement Run: --1SELECT a FROM T;\ny\nSQL Statement Run: --1SELECT 1;\n1',
    ).statements;
    expect([...resultSheetNames(statements).values()]).toEqual(['T', 'T (2)', 'Statement #3']);
    const key = statementKeys(statements).get(2);
    const custom = { [key]: 'Second run' };
    expect(resultSheetNames(statements, custom).get(2)).toBe('Second run');
    const reordered = [
      { ...statements[2], index: 1 },
      { ...statements[0], index: 2 },
      { ...statements[1], index: 3 },
    ];
    expect(resultSheetNames(reordered, custom).get(3)).toBe('Second run');
    expect(resultSheetNames([{ ...statements[1], sql: 'SELECT b FROM T;' }], custom).get(2)).toBe(
      'T',
    );
  });
});

describe('Excel Tables and names', () => {
  it('exports real tables, literal text, metadata and a header-only empty result', async () => {
    const result = parseOutputFile(
      'SQL Statement Run: --1SELECT a,b FROM T;\n0001|=SUM(1,2)\nSQL Statement Run: --1SELECT a,b FROM T;\n0 rows affected\nSQL Statement Run: --1UPDATE T SET a=1;\n2 rows affected',
    );
    const custom = {
      [statementKeys(result.statements).get(1)]:
        "'Invalid/Label? [with] * characters and a very long suffix'",
    };
    const sheets = prepareWorkbookSheets(result, custom);
    expect(sheets[0].name.length).toBeLessThanOrEqual(31);
    expect(sheets[0].name).not.toMatch(/[/*?[\]]/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await writeExcelWorkbook(sheets));
    expect(workbook.worksheets[0].getTable('Result_1').table.tableRef).toBe('A7:B8');
    expect(workbook.worksheets[0].getCell('A8').value).toBe('0001');
    expect(workbook.worksheets[0].getCell('B8').value).toBe('=SUM(1,2)');
    expect(workbook.worksheets[0].getCell('B8').type).toBe(ExcelJS.ValueType.String);
    expect(workbook.worksheets[0].getCell('B1').value).toBe(result.statements[0].sql);
    expect(workbook.worksheets[1].getTable('Result_2').table.tableRef).toBe('A7:B7');
    expect(workbook.worksheets[1].getCell('A8').value).toBeNull();
    expect(workbook.getWorksheet('_Statements').getTable('StatementData')).toBeTruthy();
  });
  it('resolves worksheet and header collisions case-insensitively, including reserved names', () => {
    const result = parseOutputFile(
      'SQL Statement Run: --1SELECT a AS Name,b AS name FROM T;\nx|y\nSQL Statement Run: --1SELECT 1;\n1',
    );
    const keys = statementKeys(result.statements);
    const sheets = prepareWorkbookSheets(result, {
      [keys.get(1)]: '_Diagnostics',
      [keys.get(2)]: '_diagnostics',
    });
    expect(new Set(sheets.map((sheet) => sheet.name.toUpperCase())).size).toBe(sheets.length);
    expect(new Set(sheets[0].rows[6].map((name) => name.toUpperCase())).size).toBe(2);
  });
});
