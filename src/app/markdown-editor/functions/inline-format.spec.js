import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { inlineFormat, wrapPlainCodeSelection } from './inline-format.js';
import { markdownParser } from './markdown.js';
import { CellProjection } from './cell-projection.js';

function toggle(source, command, anchor, head = anchor) {
  const state = EditorState.create({ doc: source, selection: { anchor, head } });
  return state.update(inlineFormat(state, command)).state;
}
describe('inline formatting', () => {
  it('unwraps the entire enclosing span, keeps the caret and then wraps only its word', () => {
    for (const [command, mark] of [
      ['bold', '**'],
      ['italic', '_'],
      ['strike', '~~'],
      ['code', '``'],
    ]) {
      const source = `Before ${mark}Apple juice${mark} after`;
      const first = toggle(source, command, source.indexOf('Apple') + 2);
      expect(first.doc.toString()).toBe('Before Apple juice after');
      expect(first.selection.main.empty).toBe(true);
      expect(first.selection.main.head).toBe(9);
      const second = first.update(inlineFormat(first, command)).state;
      expect(second.doc.toString()).toContain(
        command === 'code'
          ? '`Apple` juice'
          : command === 'italic'
            ? '*Apple* juice'
            : `${mark}Apple${mark} juice`,
      );
    }
  });
  it('splits formatting around selected text and retains nested styles', () => {
    const source = '**Apple juice**';
    expect(toggle(source, 'bold', 2, 7).doc.toString()).toBe('Apple **juice**');
    expect(toggle(source, 'bold', 8, 13).doc.toString()).toBe('**Apple** juice');
    const nested = '**a *b c* d**';
    const result = toggle(
      nested,
      'bold',
      nested.indexOf('b'),
      nested.indexOf('b') + 1,
    ).doc.toString();
    const styles = [];
    markdownParser.parse(result).iterate({
      enter(ref) {
        if (ref.name === 'Emphasis') styles.push(result.slice(ref.from, ref.to));
      },
    });
    expect(styles.some((text) => text.includes('b'))).toBe(true);
    expect(result.replace(/[*]/g, '')).toBe('a b c d');
  });
  it('uses Unicode words, punctuation boundaries, empty markers and valid backtick lengths', () => {
    expect(toggle('Apple,juice', 'bold', 2).doc.toString()).toBe('**Apple**,juice');
    expect(toggle('你好 世界', 'italic', 1).doc.toString()).toBe('*你好* 世界');
    const empty = toggle('a b', 'bold', 1);
    expect(empty.doc.toString()).toBe('a**** b');
    expect(empty.selection.main.head).toBe(3);
    expect(toggle('a`b', 'code', 0, 3).doc.toString()).toBe('``a`b``');
    const code = toggle('a`b', 'code', 0, 3);
    expect(code.sliceDoc(code.selection.main.from, code.selection.main.to)).toBe('a`b');
    const selected = toggle('one two', 'bold', 0, 3);
    expect(selected.doc.toString()).toBe('**one** two');
    expect(selected.sliceDoc(selected.selection.main.from, selected.selection.main.to)).toBe('one');
  });
  it('preserves formatting outside selections that cross existing spans', () => {
    expect(toggle('**Apple** juice', 'bold', 4, 12).doc.toString()).toBe('**Apple** **ju**ice');
    expect(toggle('one **two**', 'bold', 0, 7).doc.toString()).toBe('**one** **two**');
    expect(toggle('**one** **two**', 'bold', 2, 12).doc.toString()).toBe('one tw**o**');
    const result = toggle('*Apple* juice', 'bold', 2, 10).doc.toString();
    const styles = [];
    markdownParser.parse(result).iterate({
      enter(ref) {
        if (ref.name === 'StrongEmphasis') styles.push(result.slice(ref.from, ref.to));
      },
    });
    expect(styles).toEqual(['**pple**', '**ju**']);
  });
});

describe('typed backtick', () => {
  function wrap(source, text, { cell = false, sourceMode = false } = {}) {
    const projection = cell ? new CellProjection(source) : null;
    const doc = projection?.text ?? source;
    const start = doc.indexOf(text);
    const state = EditorState.create({
      doc,
      selection: { anchor: start + text.length, head: start },
    });
    const edit = wrapPlainCodeSelection(state, projection, sourceMode);
    return edit ? state.update(edit).state : null;
  }

  it.each([
    'plain text',
    '# plain text #',
    '- [ ] plain text',
    '> 1. plain text',
    'plain text\n===',
  ])('wraps plain text in %j and retains the reverse selection', (source) => {
    const state = wrap(source, 'plain text');
    expect(state.doc.toString()).toBe(source.replace('plain text', '`plain text`'));
    const { anchor, head } = state.selection.main;
    expect(state.sliceDoc(head, anchor)).toBe('plain text');
  });

  it.each([
    ['before **bold**', 'before **bold'],
    ['before **bold**', 'bold'],
    ['[title](https://example.com)', 'title'],
    ['![alt](image.png)', 'alt'],
    ['before <span>inside</span>', 'inside'],
    ['before `code`', 'code'],
    ['```sql\nselect 1\n```', 'select 1'],
    ['line 1\nline 2', '1\nline'],
    ['# heading', ' heading'],
    ['`code`plain', 'plain'],
    ['plain`code`', 'plain'],
    ['path\\segment', 'segment'],
    ['plain text', ''],
    ['plain text', ' '],
  ])('skips %j with %j selected', (source, selected) => {
    expect(wrap(source, selected)).toBeNull();
  });

  it('supports source table cells and inline cell context after a break', () => {
    const table = '| A | B |\n| --- | --- |\n| one | two |';
    expect(wrap(table, 'one')).toBeNull();
    expect(wrap(table, 'one', { sourceMode: true }).doc.toString()).toBe(
      table.replace('one', '`one`'),
    );
    expect(wrap('one<br>two', 'two', { cell: true }).doc.toString()).toBe('one\n`two`');
    expect(wrap('one<br>two', 'one\ntwo', { cell: true })).toBeNull();
    expect(wrap('**one<br>two**', 'two', { cell: true })).toBeNull();
    expect(wrap('a`b', 'a`b').doc.toString()).toBe('``a`b``');
  });
});
