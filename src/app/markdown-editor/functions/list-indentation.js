import { TreeFragment } from '@lezer/common';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { indentationChanges } from '../../shared/indentation.js';
import { markdownParser } from './markdown.js';

const cache = new WeakMap();
const input = (doc) => ({
  length: doc.length,
  lineChunks: false,
  chunk: (from) => doc.sliceString(from, Math.min(doc.length, from + 4096)),
  read: (from, to) => doc.sliceString(from, to),
});
const ancestor = (node, name) => {
  for (let n = node; n; n = n.parent) if (n.name === name) return n;
  return null;
};
const quotes = (node) => {
  const result = [];
  for (let n = node.parent; n; n = n.parent) if (n.name === 'Blockquote') result.push(n.from);
  return result;
};

function index(tree, doc) {
  const items = [],
    codes = [],
    quoteMarks = [];
  tree.iterate({
    enter(ref) {
      const node = ref.node;
      if (node.name === 'Image') return false;
      if (node.name === 'ListItem') {
        const mark = node.getChild('ListMark');
        if (!mark) return;
        const parent = ancestor(node.parent, 'ListItem');
        let depth = 0;
        for (let n = parent; n; n = ancestor(n.parent, 'ListItem')) depth++;
        items.push({
          node,
          mark,
          depth,
          parent: parent?.getChild('ListMark')?.from ?? -1,
          quotes: quotes(node).join(','),
        });
      }
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') codes.push(node);
      if (node.name === 'QuoteMark') quoteMarks.push(node);
    },
  });
  const byMark = new Map(
    items.map((item, i) => {
      item.index = i;
      return [item.mark.from, item];
    }),
  );
  const last = new Map();
  for (const item of items) {
    const key = `${item.parent}/${item.depth}/${item.quotes}`;
    item.previous = last.get(key);
    last.set(key, item);
  }
  const upper = (position) => {
    let low = 0,
      high = items.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (items[mid].mark.from <= position) low = mid + 1;
      else high = mid;
    }
    return low;
  };
  const owner = (line) => {
    let found = items[upper(line.to) - 1];
    while (found && found.node.to < line.to) found = byMark.get(found.parent);
    return found;
  };
  const quoteLines = new Map();
  for (const mark of quoteMarks) {
    const from = doc.lineAt(mark.from).from;
    if (!quoteLines.has(from)) quoteLines.set(from, []);
    quoteLines.get(from).push(mark);
  }
  return { items, codes, quoteLines, owner, doc, byMark, upper };
}

function quoteEnd(data, line, allowed) {
  let end = line.from;
  for (const mark of data.quoteLines.get(line.from) ?? [])
    if (
      mark.from >= line.from &&
      mark.to <= line.to &&
      (!allowed || allowed.includes(ancestor(mark.parent, 'Blockquote')?.from))
    )
      end = Math.max(end, mark.to + (data.doc.sliceString(mark.to, mark.to + 1) === ' ' ? 1 : 0));
  return end;
}

function columns(text, end = text.length) {
  let result = 0;
  for (let i = 0; i < end; i++) result += text[i] === '\t' ? 4 - (result % 4) : 1;
  return result;
}

/** Validate a proposed edit with the same GFM grammar before touching editor state. */
export function listIndentation(state, outdent = false) {
  const doc = state.doc;
  let data = cache.get(doc);
  if (!data) {
    const current = ensureSyntaxTree(state, doc.length, 150) ?? syntaxTree(state);
    const tree =
      current.length === doc.length
        ? current
        : markdownParser.parse(input(doc), TreeFragment.addTree(current, [], true));
    data = index(tree, doc);
    data.tree = tree;
    cache.set(doc, data);
  }
  const initial = indentationChanges(doc, state.selection.ranges, false);
  const lines = new Map(initial.map(({ from }) => [from, doc.lineAt(from)]));
  const selected = new Set();
  for (const line of lines.values()) {
    if (data.codes.some((code) => code.from <= line.to && code.to >= line.to)) continue;
    const item = data.owner(line);
    if (item) selected.add(item.mark.from);
  }
  const chosen = data.items.filter((item) => selected.has(item.mark.from));
  const fail = (error) => ({ changes: [], error });
  const unselected = [0];
  for (const item of data.items)
    unselected.push(unselected.at(-1) + (selected.has(item.mark.from) ? 0 : 1));
  const parents = new Map();
  for (const item of chosen) {
    if (unselected[data.upper(item.node.to - 1)] - unselected[item.index + 1] > 0)
      return fail('Select the item’s children too before changing its indentation.');
    let selectedParent = false;
    for (let p = data.byMark.get(item.parent); p; p = data.byMark.get(p.parent))
      if (selected.has(p.mark.from)) {
        selectedParent = true;
        break;
      }
    if (selectedParent) continue;
    if (outdent) {
      if (item.depth === 0) return fail('A top-level list item cannot be outdented.');
      const parent = data.byMark.get(item.parent);
      parents.set(item.mark.from, parent?.parent ?? -1);
    } else {
      let prev = item.previous,
        next = item;
      while (prev && selected.has(prev.mark.from)) {
        next = prev;
        prev = prev.previous;
      }
      if (!prev || doc.sliceString(prev.node.to, doc.lineAt(next.mark.from).from).trim())
        return fail('Indentation needs a preceding sibling to become the parent.');
      parents.set(item.mark.from, prev.mark.from);
    }
  }
  const offsets = new Map();
  for (const item of chosen) {
    const allowed = quotes(item.node);
    for (let n = doc.lineAt(item.mark.from).number; n <= doc.lineAt(item.node.to).number; n++) {
      const line = doc.line(n);
      if (data.owner(line)?.mark.from === item.mark.from && line.text.trim()) {
        lines.set(line.from, line);
        offsets.set(line.from, quoteEnd(data, line, allowed));
      }
    }
  }
  for (const line of lines.values())
    if (!offsets.has(line.from)) {
      let from = quoteEnd(data, line);
      const code = data.codes.find((c) => c.from <= line.to && c.to >= line.to);
      if (code) {
        const item = ancestor(code.parent, 'ListItem');
        if (item) {
          const mark = item.getChild('ListMark'),
            markerLine = doc.lineAt(mark.from);
          let body = mark.nextSibling;
          while (body?.name === 'QuoteMark') body = body.nextSibling;
          const content =
            body && body.from <= markerLine.to
              ? body.from - markerLine.from
              : mark.to - markerLine.from + 1;
          const floor = columns(markerLine.text, content);
          let column = columns(line.text, from - line.from);
          while (
            column < floor &&
            from < line.to &&
            /[ \t]/.test(doc.sliceString(from, from + 1))
          ) {
            column += doc.sliceString(from, from + 1) === '\t' ? 4 - (column % 4) : 1;
            from++;
          }
        }
      }
      offsets.set(line.from, from);
    }
  const changes = indentationChanges(
    doc,
    [...lines.values()].map((line) => ({ from: line.from, to: line.to })),
    outdent,
    (line) => offsets.get(line.from) ?? line.from,
  );
  if (!chosen.length || !changes.length) return { changes };
  const set = state.changes(changes),
    nextDoc = set.apply(doc),
    ranges = [];
  set.iterChangedRanges((fromA, toA, fromB, toB) => ranges.push({ fromA, toA, fromB, toB }));
  const tree = markdownParser.parse(
    input(nextDoc),
    TreeFragment.applyChanges(TreeFragment.addTree(data.tree), ranges),
  );
  const next = index(tree, nextDoc),
    byMark = new Map(next.items.map((item) => [item.mark.from, item]));
  for (const item of data.items) {
    const after = byMark.get(set.mapPos(item.mark.from, 1));
    if (!after || (selected.has(item.mark.from) && after.depth !== item.depth + (outdent ? -1 : 1)))
      return fail('Four spaces cannot make a valid one-level list change here.');
    if (parents.has(item.mark.from)) {
      const expected = parents.get(item.mark.from);
      if (after.parent !== (expected < 0 ? -1 : set.mapPos(expected, 1)))
        return fail('This indentation would break the list structure.');
    }
  }
  // Continuation blocks must remain owned by their original item. Following list
  // items may change parent, as ordinary Markdown outdenting requires.
  for (const item of data.items) {
    for (let n = doc.lineAt(item.mark.from).number; n <= doc.lineAt(item.node.to).number; n++) {
      const line = doc.line(n);
      if (!line.text.trim() || data.owner(line)?.mark.from !== item.mark.from) continue;
      const afterLine = nextDoc.lineAt(set.mapPos(line.to, -1));
      if (next.owner(afterLine)?.mark.from !== set.mapPos(item.mark.from, 1))
        return fail('This indentation would detach a list continuation.');
    }
  }
  cache.set(nextDoc, { ...next, tree });
  return { changes };
}
