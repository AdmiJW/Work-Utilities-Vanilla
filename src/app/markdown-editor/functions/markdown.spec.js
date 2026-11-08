import { describe, it, expect } from 'vitest';
import { Text } from '@codemirror/state';
import {
  markdownParser,
  readTable,
  readRow,
  tableChange,
  cellText,
  safeLink,
  linkParts,
  tableCell,
  materializeCell,
} from './markdown.js';

function model(source) {
  let node;
  markdownParser.parse(source).iterate({
    enter(ref) {
      if (ref.name === 'Table') {
        node = ref.node;
        return false;
      }
    },
  });
  return node ? readTable(node, Text.of(source.split('\n'))) : null;
}
describe('source-preserving Markdown tables', () => {
  it('keeps missing cells virtual until their first edit and preserves alignment', () => {
    const source = '| A | B | C |\n| --- | ---: | :---: |\n| x |';
    const table = model(source),
      doc = Text.of(source.split('\n'));
    expect(tableCell(table, 1, 2, doc)).toMatchObject({ value: '', virtual: true });
    expect(doc.toString()).toBe(source);
    const { changes, range } = materializeCell(table, 1, 2, doc, 'value');
    const edited = source.slice(0, changes.from) + changes.insert + source.slice(changes.to);
    expect(edited).toBe(source.replace('| x |', '| x |  | value |'));
    expect(edited.slice(range.from, range.to)).toBe('value');
    expect(model(edited).align).toEqual(table.align);
  });
  it('removes rows/columns without changing surrounding source or breaking the header', () => {
    const source = 'Before\n\n| A | B |\n| --- | --- |\n| x | y |\n| c | d |\n\nAfter';
    const original = model(source);
    const row = tableChange(original, 'remove-row', 1, 0);
    const withoutRow = source.slice(0, row.from) + row.insert + source.slice(row.to);
    expect(model(withoutRow).rows.map((r) => r.cells.map((c) => c.value))).toEqual([
      ['A', 'B'],
      ['c', 'd'],
    ]);
    const column = tableChange(original, 'remove-column', 0, 0);
    const withoutColumn = source.slice(0, column.from) + column.insert + source.slice(column.to);
    expect(model(withoutColumn).rows.map((r) => r.cells.map((c) => c.value))).toEqual([
      ['B'],
      ['y'],
      ['d'],
    ]);
    expect(withoutColumn).toMatch(/^Before\n\n/);
    expect(withoutColumn).toMatch(/\n\nAfter$/);
  });
  it('retains offsets, whitespace, empty cells and escaped pipes', () => {
    const text = '| a\\|b |  | `c\\|d` |';
    const cells = readRow(text, 20);
    expect(cells.map((c) => c.value)).toEqual(['a\\|b', '', '`c\\|d`']);
    for (const c of cells) expect(text.slice(c.from - 20, c.to - 20)).toBe(c.value);
    expect(readRow('a | b').map((c) => c.value)).toEqual(['a', 'b']);
    expect(readRow('| a\\|').map((c) => c.value)).toEqual(['a\\|']);
  });
  it('preserves blockquote prefixes and source outside structural edits', () => {
    const source = 'Before\n\n> | A | B |\n> | :--- | ---: |\n> | x | y |\n\nAfter';
    const table = model(source);
    expect(table.align).toEqual(['left', 'right']);
    const change = tableChange(table, 'add-column', 1, 0);
    const next = source.slice(0, change.from) + change.insert + source.slice(change.to);
    expect(next).toContain('Before\n\n> | A |  | B |');
    expect(next).toContain('> | x |  | y |\n\nAfter');
    expect(model(next).columns).toBe(3);
  });
  it('escapes only literal pipes and normalizes multiline cell input', () => {
    expect(cellText('a|b\nc\\|d\te')).toBe('a\\|b\nc\\|d e');
    expect(cellText('a\\\\|b')).toBe('a\\\\\\|b');
  });
  it('leaves malformed tables as source', () =>
    expect(model('| a | b |\n| -- invalid |\n| x | y |')).toBeNull());
});
describe('Markdown destinations', () => {
  it('extracts direct and reference destinations without allowing active schemes', () => {
    const source = '[hello](https://example.com "Title")';
    const node = markdownParser.parse(source).topNode.firstChild.firstChild;
    expect(linkParts(node, (a, b) => source.slice(a, b))).toMatchObject({
      label: 'hello',
      url: 'https://example.com',
    });
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,test',
      'file:///secret',
      'https://a\nb.test',
    ])
      expect(safeLink(value)).toBeNull();
    expect(safeLink('https://example.com')).toBe('https://example.com');
    expect(safeLink('mailto:hello@example.com')).toBe('mailto:hello@example.com');
  });
});
