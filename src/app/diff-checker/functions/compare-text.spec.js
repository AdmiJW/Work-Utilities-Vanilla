import { describe, expect, it } from 'vitest';
import { compareText } from './compare-text.js';

describe('text comparisons', () => {
  it('treats CRLF and LF alike while retaining case, spaces and the last line break', () => {
    expect(compareText({ left: 'One\r\nTwo\r\n', right: 'One\nTwo\n' })).toEqual([]);
    for (const right of ['one\nTwo\n', 'One \nTwo\n', 'One\nTwo'])
      expect(compareText({ left: 'One\nTwo\n', right })).not.toHaveLength(0);
  });

  it('returns aligned ranges for inserted and removed lines', () => {
    const text = 'first\nlast';
    const longer = 'first\nextra\nlast';
    expect(compareText({ left: text, right: longer })).toMatchObject([
      { fromA: 6, toA: 6, fromB: 6, toB: 12, precise: true },
    ]);
    expect(compareText({ left: longer, right: text })).toMatchObject([
      { fromA: 6, toA: 12, fromB: 6, toB: 6, precise: true },
    ]);
    expect(compareText({ left: '', right: '' })).toEqual([]);
    expect(compareText({ left: '', right: 'right' })).toHaveLength(1);
  });

  it('marks the changed characters within a line', () => {
    const [chunk] = compareText({ left: 'key:300', right: 'key:301' });
    expect(chunk.changes).toMatchObject([{ fromA: 6, toA: 7, fromB: 6, toB: 7 }]);
  });
});
