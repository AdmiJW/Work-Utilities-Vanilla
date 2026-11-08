import { it, expect } from 'vitest';
import { ChangeSet } from '@codemirror/state';
import { CellProjection, prepareCellEdit } from './cell-projection.js';

it('projects safe breaks without interpreting escaped tokens, code or HTML', () => {
  const raw = 'one<BR />two<br>three `a<br>b` \\<br> <img src=x> [x](https://a/br)';
  const p = new CellProjection(raw);
  expect(p.text).toBe('one\ntwo\nthree `a<br>b` \\<br> <img src=x> [x](https://a/br)');
  for (let i = 0; i <= p.text.length; i++) expect(p.toEditor(p.toSource(i))).toBe(i);
  const result = p.apply(ChangeSet.of({ from: 4, insert: 'X' }, p.text.length));
  expect(result.projection.source).toBe(raw.replace('two', 'Xtwo'));
  expect(result.projection.source).toContain('<BR />');
});
function prepare(before, from, insert, to = from) {
  const changes = ChangeSet.of({ from, to, insert }, before.length);
  const after = before.slice(0, from) + insert + before.slice(to);
  return prepareCellEdit(before, after, changes, {
    anchor: from + insert.length,
    head: from + insert.length,
  });
}
it('preserves leading/trailing/consecutive newlines and escapes pipes', () => {
  const result = prepare('', 0, '\na|b\n\n');
  expect(result.text).toBe('\na\\|b\n\n');
  const p = new CellProjection('');
  expect(p.apply(ChangeSet.of({ from: 0, insert: result.text }, 0)).projection.source).toBe(
    '<br>a\\|b<br><br>',
  );
});
it('splits inline code around breaks with a caret inside the next code span', () => {
  const result = prepare('`ab`', 2, '\n');
  expect(result.text).toBe('`a`\n`b`');
  expect(result.selection.head).toBe(5);
  expect(prepare('`ab`', 1, '\n').text).toBe('\n`ab`');
  expect(prepare('`ab`', 3, '\n').text).toBe('`ab`\n');
  expect(prepare('`` a`b ``', 5, '\n').text).toBe('`` a` ``\n``b``');
  expect(prepare('`[x](https://ab)`', 14, '\n').error).toBeUndefined();
});
it('rejects destination breaks atomically but permits breaks in link labels', () => {
  const raw = '[label](https://example.com)';
  expect(prepare(raw, 15, '\n').error).toBeTruthy();
  expect(prepare(raw, 3, '\n').text).toBe('[la\nbel](https://example.com)');
  expect(prepare('', 0, '[x](https://a\nb)').error).toBeTruthy();
  expect(prepare('https://example.com', 10, '\n').error).toBeTruthy();
});
