import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOutputFile } from './parse-output-file.js';
import { readDelimitedProjection } from './read-delimited-projection.js';
import { splitResultRow } from './split-result-row.js';
describe('output parsing', () => {
  it('parses all four basic SELECT blocks including empty fields and zero rows', () => {
    const result = parseOutputFile(
      readFileSync('examples/der-dpr-output analyzer/example_01_basic_results.txt', 'utf8'),
    );
    expect(result.statements).toHaveLength(4);
    expect(result.statements.map((statement) => statement.rows.length)).toEqual([2, 3, 0, 1]);
    expect(result.statements[0].rows[1].values[2]).toBe('');
    expect(result.statements[0].columns.map((column) => column.name)).toEqual([
      'Customer.CustomerId',
      'Customer.Email',
      'Customer.DisplayName',
      'Customer.AccountStatus',
      'Customer.DateTimeCreated',
    ]);
    expect(result.diagnostics).toEqual([]);
  });
  it('keeps the JSON pipe and nested escaping in their original cells', () => {
    const result = parseOutputFile(
      readFileSync('examples/der-dpr-output analyzer/example_02_json_events.txt', 'utf8'),
    );
    expect(result.statements.map((statement) => statement.rows.length)).toEqual([2, 1, 0]);
    expect(result.statements[0].columns).toHaveLength(9);
    expect(result.statements[0].rows[1].values[4]).toContain('box | fragile');
    expect(result.statements[0].rows[0].values[3]).toContain('\\"Origin\\"');
    expect(result.diagnostics).toEqual([]);
  });
  it('reads CONCAT_WS, wrappers, joins, CTEs, and duplicate headings', () => {
    const projection = readDelimitedProjection(
      "WITH c AS (SELECT 1 AS x) SELECT TOP (5) CONCAT_WS('|', ISNULL(a.[Id], ''), CONVERT(varchar(30), b.Id), CASE WHEN a.State=1 THEN a.Name ELSE a.Other END) AS result FROM dbo.A a JOIN B b ON a.Id=b.Id",
    );
    expect(projection.columns.map((column) => column.name)).toEqual([
      "ISNULL(a.[Id], '')",
      'CONVERT(varchar(30), b.Id)',
      'CASE WHEN a.State=1 THEN a.Name ELSE a.Other END',
    ]);
    expect(projection.tableName).toBe('A');
  });
  it('retains bad rows, non-SELECT messages, and unsupported SELECT output', () => {
    const result = parseOutputFile(
      "SQL Statement Run: --001SELECT CONCAT_WS('|', a,b) FROM T\na\na|b\nSQL Statement Run: --001UPDATE T SET x=1;\n2 rows affected\nmessage\nSQL Statement Run: --001SELECT * FROM T\nraw record",
    );
    expect(result.parsedRows).toBe(1);
    expect(result.statements[1].reportedRows).toBe(2);
    expect(result.statements[1].messages).toEqual(['message']);
    expect(result.statements[0].marker).toBe('001');
    expect(result.diagnostics.some((item) => item.raw === 'a')).toBe(true);
    expect(result.diagnostics.some((item) => item.raw === 'raw record')).toBe(true);
  });
  it('preserves leading/trailing whitespace, empty values, large numbers and scalar JSON', () => {
    expect(splitResultRow(' 001 |9007199254740993123||{"x":"a|b"}|"c|d"|')).toEqual([
      ' 001 ',
      '9007199254740993123',
      '',
      '{"x":"a|b"}',
      '"c|d"',
      '',
    ]);
  });
});
