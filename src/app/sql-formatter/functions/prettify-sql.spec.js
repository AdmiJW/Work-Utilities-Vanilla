import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prettifySql } from './prettify-sql.js';
import { formatSqlAsOneLine } from './format-sql-as-one-line.js';
describe('four-space SQL formatting', () => {
  it('uses four spaces for SELECT expressions', () => {
    expect(prettifySql('select a,b from demo')).toContain('\n    a,\n    b');
  });
  it.each(['complex-sales-analysis', 'der-customer-extract', 'multiple-read-only-statements'])(
    'formats and compacts the supplied %s example without touching quoted text',
    (name) => {
      const source = readFileSync(`examples/sql-formatter/${name}.sql`, 'utf8');
      const pretty = prettifySql(source);
      const compact = formatSqlAsOneLine(pretty);
      expect(compact).not.toContain('-- Sample');
      expect(
        compact.split('\n\n').every((line) => !line.includes('\n') && line.endsWith(';')),
      ).toBe(true);
      if (name === 'complex-sales-analysis') {
        expect(compact).toContain("'High; value'");
        expect(compact.split('\n')).toHaveLength(1);
      }
    },
  );
});
