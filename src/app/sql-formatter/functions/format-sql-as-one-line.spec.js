import { describe, expect, it } from 'vitest';
import { formatSqlAsOneLine } from './format-sql-as-one-line.js';
describe('formatSqlAsOneLine', () => {
  it('preserves quoted syntax while removing real comments and adding terminators', () => {
    const source =
      "-- request\nSELECT N'it''s; -- a value', [a;]]b] /* outer /* nested */ comment */ FROM T;\nUPDATE T\nSET x = '/*keep*/'";
    expect(formatSqlAsOneLine(source)).toBe(
      "SELECT N'it''s; -- a value', [a;]]b] FROM T;\n\nUPDATE T SET x = '/*keep*/';",
    );
  });
  it('supports CASE, CTEs, and nested SELECT expressions', () => {
    expect(
      formatSqlAsOneLine(
        'WITH c AS (SELECT 1 AS x) SELECT CASE WHEN x=1 THEN (SELECT 2) ELSE 0 END FROM c',
      ),
    ).toBe('WITH c AS (SELECT 1 AS x) SELECT CASE WHEN x=1 THEN (SELECT 2) ELSE 0 END FROM c;');
  });
  it('refuses literal newlines and procedural batches without rewriting them', () => {
    expect(() => formatSqlAsOneLine("SELECT 'one\ntwo'")).toThrow('physical newline');
    expect(() => formatSqlAsOneLine('BEGIN TRANSACTION; UPDATE T SET a=1;')).toThrow('standalone');
    expect(() => formatSqlAsOneLine("SELECT 'unclosed")).toThrow('Unclosed');
  });
});
