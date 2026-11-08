import { parser, GFM } from '@lezer/markdown';

export const markdownParser = parser.configure(GFM);
export const normalize = (text) => text.replace(/\r\n?/g, '\n');
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const utf8Size = (text) => new TextEncoder().encode(text).byteLength;

/** Split only unescaped pipes, retaining exact source offsets and whitespace. */
export function readRow(text, offset = 0) {
  const cuts = [];
  let slashes = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '|' && slashes % 2 === 0) cuts.push(i);
    slashes = text[i] === '\\' ? slashes + 1 : 0;
  }
  const left = /^\s*\|/.test(text) ? cuts.shift() + 1 : 0;
  const right =
    /\|\s*$/.test(text) && cuts.at(-1) === text.lastIndexOf('|') ? cuts.pop() : text.length;
  const ends = [...cuts.filter((p) => p >= left && p < right), right];
  let start = left;
  return ends.map((end) => {
    const raw = text.slice(start, end);
    const leading = raw.match(/^\s*/)[0].length;
    const value = raw.trim();
    const cell = {
      from: offset + start + leading,
      to: offset + start + leading + value.length,
      value,
    };
    start = end + 1;
    return cell;
  });
}

export function readTable(node, doc) {
  const rows = [];
  let delimiter;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (!['TableHeader', 'TableRow', 'TableDelimiter'].includes(child.name)) continue;
    const line = doc.lineAt(child.from);
    const entry = {
      from: line.from,
      to: line.to,
      prefix: doc.sliceString(line.from, child.from),
      cells: readRow(doc.sliceString(child.from, line.to), child.from),
    };
    if (child.name === 'TableDelimiter') delimiter = entry;
    else rows.push(entry);
  }
  if (!rows.length || !delimiter) return null;
  const columns = rows[0].cells.length;
  return {
    from: doc.lineAt(node.from).from,
    to: doc.lineAt(node.to).to,
    rows,
    delimiter,
    columns,
    align: delimiter.cells.map(({ value }) =>
      value.startsWith(':')
        ? value.endsWith(':')
          ? 'center'
          : 'left'
        : value.endsWith(':')
          ? 'right'
          : 'left',
    ),
  };
}

export function cellText(value) {
  let result = '',
    slashes = 0;
  for (const char of normalize(value).replace(/\t/g, ' ')) {
    if (char === '|' && slashes % 2 === 0) result += '\\';
    result += char;
    slashes = char === '\\' ? slashes + 1 : 0;
  }
  return result;
}

export function tableCell(model, row, column, doc) {
  const cell = model.rows[row].cells[column];
  if (cell) return { ...cell, virtual: false };
  const entry = model.rows[row],
    raw = doc.sliceString(entry.from, entry.to);
  const tail = raw.search(/\|\s*$/);
  let slashes = 0;
  for (let i = tail - 1; i >= 0 && raw[i] === '\\'; i--) slashes++;
  const terminal = tail >= entry.prefix.length && slashes % 2 === 0;
  const from = terminal ? entry.from + tail : entry.to;
  return { from, to: from, value: '', virtual: true, terminal };
}

export function materializeCell(model, row, column, doc, value) {
  const cell = tableCell(model, row, column, doc);
  const missing = column - model.rows[row].cells.length;
  const prefix = (cell.terminal ? '|' : ' |') + '  |'.repeat(Math.max(0, missing)) + ' ';
  const insert = prefix + value + (cell.terminal ? ' ' : '');
  return {
    changes: { from: cell.from, to: cell.to, insert },
    range: { from: cell.from + prefix.length, to: cell.from + prefix.length + value.length },
  };
}

/** Structural edits serialize only the affected table, retaining its container prefix. */
export function tableChange(model, operation, row = 0, column = 0) {
  const values = model.rows.map((r) =>
    Array.from({ length: model.columns }, (_, c) => r.cells[c]?.value ?? ''),
  );
  const align = [...model.align];
  if (operation === 'add-row') values.splice(row + 1, 0, Array(model.columns).fill(''));
  if (operation === 'remove-row') {
    if (row === 0) values[0] = Array(model.columns).fill('');
    else values.splice(row, 1);
  }
  if (operation === 'add-column') {
    values.forEach((r) => r.splice(column + 1, 0, ''));
    align.splice(column + 1, 0, 'left');
  }
  if (operation === 'remove-column') {
    if (model.columns === 1) return { from: model.from, to: model.to, insert: '' };
    values.forEach((r) => r.splice(column, 1));
    align.splice(column, 1);
  }
  if (['left', 'center', 'right'].includes(operation)) align[column] = operation;
  const line = (cells, prefix) => `${prefix}| ${cells.join(' | ')} |`;
  const prefix = model.rows[1]?.prefix ?? model.delimiter.prefix;
  const lines = [
    line(values[0], model.rows[0].prefix),
    line(
      align.map((a) => (a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---')),
      model.delimiter.prefix,
    ),
  ];
  lines.push(...values.slice(1).map((r) => line(r, prefix)));
  return { from: model.from, to: model.to, insert: lines.join('\n') };
}

export function safeLink(url) {
  const value = url.trim().replace(/\\([\\()[\]])/g, '$1');
  return /^(https?:\/\/|mailto:)/i.test(value) &&
    ![...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)
    ? value
    : null;
}

export function referenceKey(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function linkParts(node, read, references = new Map()) {
  const image = node.name === 'Image';
  const start = node.from + (image ? 2 : 1);
  let url = '',
    end = node.to - 1;
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'URL') url = read(c.from, c.to).replace(/^<|>$/g, '');
    if (c.name === 'LinkMark' && c.from >= start && read(c.from, c.to).startsWith(']')) {
      end = c.from;
      break;
    }
  }
  if (!url) {
    for (let c = node.firstChild; c; c = c.nextSibling)
      if (c.name === 'URL') url = read(c.from, c.to).replace(/^<|>$/g, '');
  }
  if (!url) {
    const raw = read(node.from, node.to);
    const label = raw.match(/\[([^\]]*)\]\s*$/)?.[1];
    url = references.get(referenceKey(label || read(start, end))) ?? '';
  }
  return { from: start, to: end, label: read(start, end), url };
}
