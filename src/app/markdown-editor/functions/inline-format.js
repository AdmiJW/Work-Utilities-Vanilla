import { markdownParser } from './markdown.js';

const kinds = {
  bold: 'StrongEmphasis',
  italic: 'Emphasis',
  strike: 'Strikethrough',
  code: 'InlineCode',
};
const delimiters = { bold: '**', italic: '*', strike: '~~', code: '`' };

function wrap(text, delimiter) {
  if (!text) return '';
  if (delimiter.startsWith('`')) {
    const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
    const mark = '`'.repeat(Math.max(delimiter.length, longest + 1));
    const pad = /^`|`$/.test(text) || (/^ .* $/s.test(text) && /\S/.test(text)) ? ' ' : '';
    return mark + pad + text + pad + mark;
  }
  const [, leading, body, trailing] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return body ? leading + delimiter + body + delimiter + trailing : text;
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
    const codePadding = (raw) =>
      /^`|`$/.test(raw) || (/^ .* $/s.test(raw) && /\S/.test(raw)) ? 1 : 0;
    const prefix = first
      ? command === 'code'
        ? first.insert.match(/^`+/)[0].length + codePadding(text.slice(first.from, first.to))
        : !/^\s/.test(text.slice(first.from, first.to))
          ? delimiters[command].length
          : 0
      : 0;
    const suffix = last
      ? command === 'code'
        ? last.insert.match(/`+$/)[0].length + codePadding(text.slice(last.from, last.to))
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
