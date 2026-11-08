import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { markdown, commonmarkLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { listIndentation } from './list-indentation.js';

function edit(source, needle, outdent = false, end) {
  const anchor = source.indexOf(needle),
    head = end === undefined ? anchor : source.indexOf(end) + end.length;
  const state = EditorState.create({
    doc: source,
    selection: { anchor, head },
    extensions: [markdown({ base: commonmarkLanguage, extensions: [GFM] })],
  });
  const result = listIndentation(state, outdent);
  return { ...result, text: state.changes(result.changes).apply(state.doc).toString() };
}
describe('guarded Markdown indentation', () => {
  const source = '- Lvl 1\n    - Lvl 2a\n    - Lvl 2b';
  it('enforces the agreed first-child/root limits and permits the two leaf outdents', () => {
    expect(edit(source, 'Lvl 1').error).toBeTruthy();
    expect(edit(source, 'Lvl 1', true).error).toBeTruthy();
    expect(edit(source, 'Lvl 2a').error).toBeTruthy();
    expect(edit(source, 'Lvl 2a', true).text).toBe('- Lvl 1\n- Lvl 2a\n    - Lvl 2b');
    expect(edit(source, 'Lvl 2b').text).toBe('- Lvl 1\n    - Lvl 2a\n        - Lvl 2b');
    expect(edit(source, 'Lvl 2b', true).text).toBe('- Lvl 1\n    - Lvl 2a\n- Lvl 2b');
  });
  it('blocks unselected descendants but permits an explicitly selected subtree', () => {
    const value = '- A\n- B\n    - C';
    expect(edit(value, 'B').error).toBeTruthy();
    expect(edit(value, 'B', false, 'C').text).toBe('- A\n    - B\n        - C');
    expect(edit(source, 'Lvl 2a', false, 'Lvl 2b').text).toBe(source);
  });
  it('moves continuation paragraphs with their item and preserves unrelated text', () => {
    const value = 'Intro\n\n- A\n- B\n\n  continuation\n\nAfter';
    expect(edit(value, 'B').text).toBe('Intro\n\n- A\n    - B\n\n      continuation\n\nAfter');
  });
  it('permits mixed list types, guards wide markers, and edits after quote prefixes', () => {
    expect(edit('- A\n1. B', 'B').text).toBe('- A\n    1. B');
    expect(edit('100. A\n101. B', 'B').error).toBeTruthy();
    expect(edit('> - A\n> - B', 'B').text).toBe('> - A\n>     - B');
  });
  it('indents code content instead of nesting its containing item', () => {
    const value = '- A\n\n    ```js\n    let x=1;\n    ```';
    expect(edit(value, 'let x').text).toBe(value.replace('    let', '        let'));
    expect(edit(value, 'let x', true).text).toBe(value.replace('    let', '  let'));
    const tabs = value.replaceAll('    ', '\t');
    expect(edit(tabs, 'let x', true).text).toBe(tabs);
  });
});
