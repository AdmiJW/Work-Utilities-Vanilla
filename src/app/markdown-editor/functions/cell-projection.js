import { markdownParser, normalize } from './markdown.js';

export const isCellBreak = (text) => /^<br[ \t]*\/?\s*>$/i.test(text);
export function inlineNodes(text, visit) {
  const source = 'x ' + text;
  markdownParser.parse(source).iterate({
    enter(ref) {
      if (ref.from < 2) return;
      return visit(ref.node, ref.from - 2, ref.to - 2);
    },
  });
}

/** Only real HTMLTag tokens become breaks: escaped text, code and URLs are literal. */
export class CellProjection {
  constructor(source) {
    this.source = source;
    this.breaks = [];
    inlineNodes(source, (node, from, to) => {
      if (node.name === 'InlineCode' || node.name === 'Image') return false;
      if (node.name === 'HTMLTag' && isCellBreak(source.slice(from, to)))
        this.breaks.push({ from, to });
    });
    let start = 0,
      delta = 0;
    const parts = [];
    for (const span of this.breaks) {
      parts.push(source.slice(start, span.from), '\n');
      span.editor = span.from - delta;
      delta += span.to - span.from - 1;
      start = span.to;
    }
    parts.push(source.slice(start));
    this.text = parts.join('');
  }
  toEditor(position, assoc = 1) {
    let delta = 0;
    for (const span of this.breaks) {
      if (position <= span.from) break;
      if (position < span.to) return span.editor + (assoc > 0 ? 1 : 0);
      delta += span.to - span.from - 1;
    }
    return Math.max(0, Math.min(this.text.length, position - delta));
  }
  toSource(position) {
    let delta = 0;
    for (const span of this.breaks) {
      if (position <= span.editor) break;
      delta += span.to - span.from - 1;
    }
    return Math.max(0, Math.min(this.source.length, position + delta));
  }
  selection(anchor, head = anchor) {
    const forward = anchor <= head;
    return {
      anchor: this.toEditor(anchor, anchor === head ? 1 : forward ? -1 : 1),
      head: this.toEditor(head, anchor === head ? 1 : forward ? 1 : -1),
    };
  }
  apply(changes) {
    const edits = [];
    changes.iterChanges((from, to, _a, _b, insert) =>
      edits.push({
        from: this.toSource(from),
        to: this.toSource(to),
        insert: insert.toString().replaceAll('\n', '<br>'),
      }),
    );
    let source = this.source;
    for (const edit of [...edits].reverse())
      source = source.slice(0, edit.from) + edit.insert + source.slice(edit.to);
    return { edits, projection: new CellProjection(source) };
  }
}

function replace(text, edits) {
  const sorted = edits.sort((a, b) => a.from - b.from);
  let value = text;
  for (const edit of [...sorted].reverse())
    value = value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
  return {
    text: value,
    map(position) {
      let delta = 0;
      for (const edit of sorted) {
        if (position < edit.from) break;
        if (position <= edit.to)
          return (
            edit.from +
            delta +
            (edit.inside ? edit.inside(position - edit.from) : edit.insert.length)
          );
        delta += edit.insert.length - (edit.to - edit.from);
      }
      return position + delta;
    },
  };
}

function codePart(text, preferred) {
  if (!text) return { text: '', prefix: 0 };
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const delimiter = '`'.repeat(Math.max(preferred, longest + 1));
  const pad = /^`|`$/.test(text) || (/^ .* $/s.test(text) && /[^ ]/.test(text));
  return {
    text: delimiter + (pad ? ' ' : '') + text + (pad ? ' ' : '') + delimiter,
    prefix: delimiter.length + (pad ? 1 : 0),
  };
}

const targets = (text) => {
  const result = [];
  inlineNodes(text.replaceAll('\n', ' '), (node, from, to) => {
    if (node.name === 'InlineCode') return false;
    if (node.name === 'URL' || node.name === 'Autolink') result.push({ from, to });
  });
  return result;
};

/** Normalize a local cell transaction, preserving its caret through code splitting. */
export function prepareCellEdit(before, after, changes, selection) {
  const oldTargets = targets(before);
  let invalid = false;
  changes.iterChanges((from, to, _a, _b, insert) => {
    if (
      insert.toString().includes('\n') &&
      oldTargets.some((t) => (from > t.from && from < t.to) || (to > t.from && to < t.to))
    )
      invalid = true;
  });
  // A pasted, broken destination can cease to parse as a link. Detect that case
  // before the parser's normal malformed-Markdown fallback loses its URL node.
  const codeRegions = [];
  inlineNodes(after.replaceAll('\n', ' '), (node, from, to) => {
    if (node.name === 'InlineCode') {
      codeRegions.push({ from, to });
      return false;
    }
  });
  for (const match of after.matchAll(/\]\([^)]*\n[^)]*\)|<(?:https?:\/\/|mailto:)[^>]*\n[^>]*>/g))
    if (
      !codeRegions.some(
        (region) => region.from <= match.index && region.to >= match.index + match[0].length,
      )
    )
      invalid = true;
  if (invalid)
    return { error: 'Line breaks cannot be inserted inside a link or image destination.' };
  let anchor = selection.anchor,
    head = selection.head;
  const sanitize = [];
  let slashes = 0;
  for (let i = 0; i < after.length; i++) {
    if (after[i] === '\t') sanitize.push({ from: i, to: i + 1, insert: ' ' });
    if (after[i] === '|' && slashes % 2 === 0) sanitize.push({ from: i, to: i, insert: '\\' });
    slashes = after[i] === '\\' ? slashes + 1 : 0;
  }
  const stage = replace(normalize(after), sanitize);
  anchor = stage.map(anchor);
  head = stage.map(head);
  const split = [];
  inlineNodes(stage.text.replaceAll('\n', ' '), (node, from, to) => {
    if (node.name !== 'InlineCode') return;
    const start = node.firstChild.to - 2,
      end = node.lastChild.from - 2;
    let content = stage.text.slice(start, end),
      trimmed = 0;
    if (!content.includes('\n')) return false;
    if (content.startsWith(' ') && content.endsWith(' ') && /[^ \n]/.test(content)) {
      content = content.slice(1, -1);
      trimmed = 1;
    }
    const pieces = content.split('\n'),
      serialized = pieces.map((p) => codePart(p, node.firstChild.to - node.firstChild.from));
    const insert = serialized.map((p) => p.text).join('\n');
    split.push({
      from,
      to,
      insert,
      inside(position) {
        let p = Math.max(0, Math.min(content.length, position - (start - from) - trimmed)),
          offset = 0;
        for (let i = 0; i < pieces.length; i++) {
          if (p <= pieces[i].length) return offset + serialized[i].prefix + p;
          p -= pieces[i].length + 1;
          offset += serialized[i].text.length + 1;
        }
        return insert.length;
      },
    });
    return false;
  });
  const processed = replace(stage.text, split);
  anchor = processed.map(anchor);
  head = processed.map(head);
  // Canonicalize typed break tags too. Existing encoded breaks keep their exact
  // spelling in CellProjection.apply, rather than serializing the whole cell.
  const raw = processed.text.replaceAll('\n', '<br>'),
    projection = new CellProjection(raw);
  const encoded = (p) => p + 3 * (processed.text.slice(0, p).match(/\n/g)?.length ?? 0);
  return {
    text: projection.text,
    selection: {
      anchor: projection.toEditor(encoded(anchor)),
      head: projection.toEditor(encoded(head)),
    },
  };
}
