import { isolateHistory } from '@codemirror/commands';

export const INDENT = '    ';

/** Positions use normalized editor text, never serialized CRLF offsets. */
export function indentationChanges(doc, ranges, outdent = false, offset = (line) => line.from) {
  const lineAt =
    typeof doc === 'string'
      ? (pos) => {
          const from = pos > 0 ? doc.lastIndexOf('\n', pos - 1) + 1 : 0;
          const next = doc.indexOf('\n', pos);
          const to = next < 0 ? doc.length : next;
          return { from, to, text: doc.slice(from, to) };
        }
      : (pos) => doc.lineAt(pos);
  const lines = new Map();
  for (const range of ranges) {
    const from = Math.min(range.anchor ?? range.from, range.head ?? range.to ?? range.anchor),
      to = Math.max(range.anchor ?? range.from, range.head ?? range.to ?? range.anchor);
    const last = lineAt(to);
    const end = to > from && to === last.from ? to - 1 : to;
    for (let line = lineAt(from); line.from <= end;) {
      lines.set(line.from, line);
      if (line.to >= doc.length) break;
      line = lineAt(line.to + 1);
    }
  }
  return [...lines.values()]
    .sort((a, b) => a.from - b.from)
    .flatMap((line) => {
      const from = offset(line);
      const rest = line.text.slice(from - line.from);
      if (!outdent) return [{ from, to: from, insert: INDENT }];
      let columns = 0,
        count = 0;
      while (count < rest.length && columns < 4 && /[ \t]/.test(rest[count])) {
        columns += rest[count] === '\t' ? 4 - (columns % 4) : 1;
        count++;
      }
      return count ? [{ from, to: from + count, insert: '' }] : [];
    });
}

export function mapIndentPosition(position, changes) {
  let delta = 0;
  for (const change of changes) {
    if (position < change.from) break;
    if (position <= change.to) return change.from + delta + change.insert.length;
    delta += change.insert.length - (change.to - change.from);
  }
  return position + delta;
}

export function applyIndentation(
  view,
  outdent,
  changes = indentationChanges(view.state.doc, view.state.selection.ranges, outdent),
) {
  if (view.state.readOnly || view.composing || view.compositionStarted) return false;
  if (changes.length) {
    const set = view.state.changes(changes);
    view.dispatch({
      changes: set,
      selection: view.state.selection.map(set, 1),
      annotations: isolateHistory.of('full'),
      userEvent: 'input.indent',
      scrollIntoView: true,
    });
  }
  return true;
}
