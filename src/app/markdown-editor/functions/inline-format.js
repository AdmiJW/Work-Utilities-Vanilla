import { ensureSyntaxTree } from '@codemirror/language';
import { markdownParser } from './markdown.js';
import { htmlRoots } from './html-roots.js';
import { inlineNodes } from './cell-projection.js';

const kinds = {
  bold: 'StrongEmphasis',
  italic: 'Emphasis',
  strike: 'Strikethrough',
  code: 'InlineCode',
};
const delimiters = { bold: '**', italic: '*', strike: '~~', code: '`' };
const codePadding = (text) => /^`|`$/.test(text) || (/^ .* $/s.test(text) && /\S/.test(text));

function wrap(text, delimiter) {
  if (!text) return '';
  if (delimiter.startsWith('`')) {
    const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
    const mark = '`'.repeat(Math.max(delimiter.length, longest + 1));
    const pad = codePadding(text) ? ' ' : '';
    return mark + pad + text + pad + mark;
  }
  const [, leading, body, trailing] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return body ? leading + delimiter + body + delimiter + trailing : text;
}

const prose = /^(Paragraph|ATXHeading[1-6]|SetextHeading[1-6]|Task|TableCell)$/;
const containers = new Set([
  'Document',
  'Blockquote',
  'BulletList',
  'OrderedList',
  'ListItem',
  'Table',
  'TableHeader',
  'TableRow',
]);

/** Typed backticks wrap plain text only. The toolbar still supports toggling code spans. */
export function wrapPlainCodeSelection(state, cell = null, sourceMode = false) {
  const { from, to, anchor } = state.selection.main;
  if (state.readOnly || from === to) return null;
  const line = state.doc.lineAt(from);
  if (to > line.to) return null;
  const selected = state.sliceDoc(from, to);
  if (!selected.trim()) return null;

  // A delimiter cannot start against another backtick run or after an odd escape.
  const before = line.text.slice(0, from - line.from);
  if (
    before.endsWith('`') ||
    line.text[to - line.from] === '`' ||
    /(?:^|[^\\])(?:\\\\)*\\$/.test(before)
  )
    return null;
  const overlaps = (start, end) => start < to && end > from;
  if (htmlRoots(state.doc, !!cell).some((root) => overlaps(root.from, root.to))) return null;

  if (cell) {
    const start = cell.toSource(from),
      end = cell.toSource(to);
    let blocked = false;
    inlineNodes(cell.source, (_node, left, right) => {
      if (left < end && right > start) blocked = true;
      return false;
    });
    if (blocked) return null;
  } else {
    let insideText = false,
      blocked = false;
    const tree = ensureSyntaxTree(state, to, 50) ?? markdownParser.parse(state.doc.toString());
    tree.iterate({
      from,
      to,
      enter(node) {
        if (!overlaps(node.from, node.to)) return false;
        if (node.name === 'Table' && !sourceMode) blocked = true;
        if (containers.has(node.name)) return !blocked;
        if (!prose.test(node.name)) {
          blocked = true;
          return false;
        }
        const first = node.node.firstChild,
          last = node.node.lastChild;
        const startsWithMarker =
          first?.name === 'TaskMarker' ||
          (first?.name === 'HeaderMark' && node.name.startsWith('ATX'));
        const textFrom = startsWithMarker
          ? first.to + state.sliceDoc(first.to, node.to).match(/^\s*/)[0].length
          : node.from;
        const textTo =
          startsWithMarker && first !== last && last.name === 'HeaderMark' && last.from > first.to
            ? last.from - state.sliceDoc(textFrom, last.from).match(/\s*$/)[0].length
            : node.to;
        insideText ||= from >= textFrom && to <= textTo;
        return true;
      },
    });
    if (blocked || !insideText) return null;
  }

  const insert = wrap(selected, '`');
  const start = from + insert.match(/^`+/)[0].length + Number(codePadding(selected));
  const end = start + selected.length;
  return {
    changes: { from, to, insert },
    selection: anchor === from ? { anchor: start, head: end } : { anchor: end, head: start },
  };
}

/** Clip an inline subtree without leaving half of a nested emphasis delimiter. */
function slice(node, from, to, text) {
  let value = '',
    position = from;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.to <= from || child.from >= to) continue;
    if (child.from > position) value += text.slice(position, Math.min(child.from, to));
    const a = Math.max(from, child.from),
      b = Math.min(to, child.to);
    if (Object.values(kinds).includes(child.name)) {
      const open = child.firstChild,
        close = child.lastChild;
      const innerFrom = Math.max(a, open.to),
        innerTo = Math.min(b, close.from);
      if (innerFrom < innerTo)
        value += wrap(slice(child, innerFrom, innerTo, text), text.slice(open.from, open.to));
    } else value += text.slice(a, b);
    position = Math.max(position, b);
  }
  if (position < to) value += text.slice(position, to);
  return value;
}

/** Return one isolated edit, retaining a collapsed caret through an enclosing toggle. */
export function inlineFormat(state, command) {
  const kind = kinds[command];
  if (!kind) return null;
  const text = state.doc.toString(),
    range = state.selection.main;
  const nodes = [],
    formats = [];
  markdownParser.parse(text).iterate({
    enter(ref) {
      if (ref.name === kind) nodes.push(ref.node);
      if (Object.values(kinds).includes(ref.name)) formats.push(ref.node);
    },
  });
  const enclosing = nodes
    .filter((n) => n.from <= range.from && n.to >= range.to)
    .sort((a, b) => a.to - a.from - (b.to - b.from))[0];
  if (enclosing) {
    const open = enclosing.firstChild,
      close = enclosing.lastChild;
    if (range.empty || (range.from <= open.to && range.to >= close.from)) {
      const changes = [
        { from: open.from, to: open.to, insert: '' },
        { from: close.from, to: close.to, insert: '' },
      ];
      const mapping = state.changes(changes);
      return {
        changes,
        selection: { anchor: mapping.mapPos(range.anchor), head: mapping.mapPos(range.head) },
      };
    }
    const from = Math.max(open.to, range.from),
      to = Math.min(close.from, range.to);
    const before = wrap(slice(enclosing, open.to, from, text), text.slice(open.from, open.to));
    const middle = slice(enclosing, from, to, text);
    const after = wrap(slice(enclosing, to, close.from, text), text.slice(open.from, open.to));
    const start = enclosing.from + before.length,
      end = start + middle.length;
    return {
      changes: { from: enclosing.from, to: enclosing.to, insert: before + middle + after },
      selection:
        range.anchor <= range.head ? { anchor: start, head: end } : { anchor: end, head: start },
    };
  }
  if (!range.empty) {
    const touched = nodes.filter((node) => node.from < range.to && node.to > range.from);
    const protectedRanges = [
      ...touched.map((node) => ({ from: node.from, to: node.to })),
      ...formats
        .filter((node) => node.name !== kind && command !== 'code')
        .flatMap((node) => [node.firstChild, node.lastChild]),
    ].sort((a, b) => a.from - b.from);
    const gaps = [];
    let position = range.from;
    for (const span of protectedRanges) {
      if (span.to <= position || span.from >= range.to) continue;
      if (span.from > position) gaps.push({ from: position, to: Math.min(range.to, span.from) });
      position = Math.max(position, span.to);
    }
    if (position < range.to) gaps.push({ from: position, to: range.to });
    if (touched.length && gaps.every(({ from, to }) => !text.slice(from, to).trim())) {
      const edits = [],
        operations = [];
      for (const node of touched.filter(
        (node) =>
          !touched.some(
            (other) => other !== node && other.from <= node.from && other.to >= node.to,
          ),
      )) {
        const start = Math.max(range.from, node.firstChild.to),
          end = Math.min(range.to, node.lastChild.from);
        if (start >= end) continue;
        const local = state.update({ selection: { anchor: start, head: end } }).state;
        const result = inlineFormat(local, command);
        const changes = Array.isArray(result.changes) ? result.changes : [result.changes];
        edits.push(...changes);
        operations.push({ node, result, changes });
      }
      const map = state.changes(edits);
      const endpoint = (point, end) => {
        const operation = operations.find(({ node }) => point >= node.from && point <= node.to);
        if (!operation) return map.mapPos(point, end ? 1 : -1);
        const adjustment = edits
          .filter((edit) => edit.to <= operation.node.from)
          .reduce((sum, edit) => sum + edit.insert.length - (edit.to - edit.from), 0);
        return (
          adjustment + (end ? operation.result.selection.head : operation.result.selection.anchor)
        );
      };
      const start = endpoint(range.from, false),
        end = endpoint(range.to, true);
      return {
        changes: edits,
        selection:
          range.anchor <= range.head ? { anchor: start, head: end } : { anchor: end, head: start },
      };
    }
    const edits = gaps
      .filter(({ from, to }) => text.slice(from, to).trim())
      .map(({ from, to }) => ({
        from,
        to,
        insert: wrap(text.slice(from, to), delimiters[command]),
      }));
    const map = state.changes(edits),
      first = edits.find((edit) => edit.from === range.from),
      last = edits.find((edit) => edit.to === range.to);
    const prefix = first
      ? command === 'code'
        ? first.insert.match(/^`+/)[0].length +
          Number(codePadding(text.slice(first.from, first.to)))
        : !/^\s/.test(text.slice(first.from, first.to))
          ? delimiters[command].length
          : 0
      : 0;
    const suffix = last
      ? command === 'code'
        ? last.insert.match(/`+$/)[0].length + Number(codePadding(text.slice(last.from, last.to)))
        : !/\s$/.test(text.slice(last.from, last.to))
          ? delimiters[command].length
          : 0
      : 0;
    const start = map.mapPos(range.from, -1) + prefix;
    const end = map.mapPos(range.to, 1) - suffix;
    return {
      changes: edits,
      selection:
        range.anchor <= range.head ? { anchor: start, head: end } : { anchor: end, head: start },
    };
  }
  let { from, to } = range;
  if (range.empty) {
    // Editor word boundaries intentionally stop at punctuation, including hyphens.
    const word = /[\p{L}\p{N}\p{M}_]/u;
    if (word.test(text[from] ?? '')) {
      while (from > 0 && word.test(text[from - 1])) from--;
      while (to < text.length && word.test(text[to])) to++;
    } else if (from > 0 && word.test(text[from - 1] ?? '') && !/\s/.test(text[from] ?? '')) {
      while (from > 0 && word.test(text[from - 1])) from--;
    }
  }
  const delimiter = delimiters[command];
  let selected = text.slice(from, to);
  // Existing complete spans inside a mixed selection should not be double wrapped.
  for (const node of nodes.filter((n) => n.from >= from && n.to <= to).reverse()) {
    const a = node.firstChild,
      b = node.lastChild;
    selected =
      selected.slice(0, a.from - from) +
      selected.slice(a.to - from, b.from - from) +
      selected.slice(b.to - from);
  }
  const insert = selected ? wrap(selected, delimiter) : delimiter + delimiter;
  const prefix = insert.indexOf(selected || delimiter) + (selected ? 0 : delimiter.length);
  const anchor = range.empty
    ? from +
      (selected
        ? Math.min(insert.length - delimiter.length, delimiter.length + range.head - from)
        : prefix)
    : from + delimiter.length;
  return {
    changes: { from, to, insert },
    selection: range.empty
      ? { anchor }
      : { anchor: from + delimiter.length, head: from + insert.length - delimiter.length },
  };
}

export function inlineSpanActive(node, selection, reading = false) {
  return !reading && node.from <= selection.to && node.to >= selection.from;
}
