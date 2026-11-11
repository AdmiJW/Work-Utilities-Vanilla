import { describe, expect, it } from 'vitest';
import { readHTMLRoots } from './html-roots.js';

describe('HTML source roots', () => {
  it('retains exact root ranges, separates siblings and includes descendants atomically', () => {
    const text =
      'Before <span title="a > b">one <b>two</b></span> after\n\n<div><p>block</p></div><hr>\n';
    const roots = readHTMLRoots(text);
    expect(roots.map((root) => root.raw)).toEqual([
      '<span title="a > b">one <b>two</b></span>',
      '<div><p>block</p></div>',
      '<hr>',
    ]);
    for (const root of roots) expect(text.slice(root.from, root.to)).toBe(root.raw);
    expect(readHTMLRoots(text, true).map((root) => root.raw)).toEqual([roots[0].raw]);
  });
  it('does not interpret literal code, escapes, destinations or malformed roots as HTML widgets', () => {
    const text =
      '```html\n<div>fenced</div>\n```\n\n`<b>code</b>` \\<i>escaped</i>\n\n<div>unclosed';
    expect(readHTMLRoots(text)).toEqual([]);
    expect(readHTMLRoots('<div><p>unclosed child</div>')).toEqual([]);
    expect(readHTMLRoots('a < b')).toEqual([]);
  });
  it('supports HTML tables and inline roots inside Markdown table cells', () => {
    const text = '| A |\n| --- |\n| <span>value</span> |\n\n<table><tr><td>x</td></tr></table>';
    expect(readHTMLRoots(text).map((root) => root.block)).toEqual([false, true]);
  });
});
