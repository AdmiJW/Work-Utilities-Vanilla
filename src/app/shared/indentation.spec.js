import { expect, it } from 'vitest';
import { Text } from '@codemirror/state';
import { indentationChanges, mapIndentPosition } from './indentation.js';

it('indents lines rather than caret text and excludes a selection-end line start', () => {
  const text = 'alpha\nbeta\ngamma';
  const changes = indentationChanges(text, [{ anchor: 11, head: 2 }]);
  expect(changes).toEqual([
    { from: 0, to: 0, insert: '    ' },
    { from: 6, to: 6, insert: '    ' },
  ]);
  expect(mapIndentPosition(11, changes)).toBe(19);
  expect(mapIndentPosition(2, changes)).toBe(6);
  expect(indentationChanges(Text.of(text.split('\n')), [{ anchor: 11, head: 2 }])).toEqual(changes);
});
it('outdents partial whitespace and handles empty/leading-empty lines', () => {
  expect(indentationChanges('  a\n\tb', [{ from: 0, to: 6 }], true)).toEqual([
    { from: 0, to: 2, insert: '' },
    { from: 4, to: 5, insert: '' },
  ]);
  expect(indentationChanges('\na', [{ from: 0, to: 0 }])).toEqual([
    { from: 0, to: 0, insert: '    ' },
  ]);
});
