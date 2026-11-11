import { Annotation, EditorState, Transaction } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';
import { markdownParser } from '../functions/markdown.js';
import { htmlRoots } from '../functions/html-roots.js';
import { isCellBreak } from '../functions/cell-projection.js';

export const allowHTML = Annotation.define();

function introducesTag(tr, cell) {
  const insertions = [];
  let syntax = false;
  tr.changes.iterChanges((_a, _b, _c, _d, insert) => {
    if (/[<>]/.test(insert.toString())) syntax = true;
  });
  if (!syntax) return false;
  tr.changes.iterChangedRanges((_a, _b, from, to) => {
    if (to > from) insertions.push({ from, to });
  });
  if (!insertions.length) return false;
  const source = tr.newDoc.toString();
  let found = false;
  markdownParser.parse(source).iterate({
    enter(ref) {
      if (['FencedCode', 'CodeBlock', 'InlineCode', 'URL', 'Autolink', 'Image'].includes(ref.name))
        return false;
      if (ref.name !== 'HTMLBlock' && ref.name !== 'HTMLTag') return;
      const raw = source.slice(ref.from, ref.to);
      for (const tag of raw.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
        const from = ref.from + tag.index,
          to = from + tag[0].length;
        if (
          insertions.some((range) => range.from < to && range.to > from) &&
          !(cell && isCellBreak(tag[0]))
        )
          found = true;
      }
      return false;
    },
  });
  return found;
}

export function liveEditing(owner, cell = false, syncing = () => false) {
  return EditorState.transactionFilter.of((tr) => {
    if (
      owner.mode !== 'live' ||
      !tr.docChanged ||
      syncing() ||
      tr.annotation(allowHTML) ||
      (!tr.isUserEvent('input') && !tr.isUserEvent('delete'))
    )
      return tr;
    if (!cell && owner.activeTable?.writing) return tr;
    if (introducesTag(tr, cell)) {
      owner.notify('Switch to Source to insert HTML.');
      return [];
    }
    const roots = htmlRoots(tr.startState.doc, cell);
    const edits = [];
    let expanded = false;
    tr.changes.iterChanges((from, to, _a, _b, insert) => {
      for (const root of roots) {
        if (
          (from < root.to && to > root.from) ||
          (from === to && from > root.from && from < root.to)
        ) {
          expanded ||= from > root.from || to < root.to;
          from = Math.min(from, root.from);
          to = Math.max(to, root.to);
        }
      }
      const last = edits.at(-1);
      if (last && from <= last.to) {
        last.to = Math.max(last.to, to);
        last.insert += insert.toString();
      } else edits.push({ from, to, insert: insert.toString() });
    });
    if (expanded) {
      const map = tr.startState.changes(edits),
        selection = tr.newSelection.main;
      const original = tr.changes.invertedDesc;
      return {
        changes: edits,
        selection: {
          anchor: map.mapPos(original.mapPos(selection.anchor), 1),
          head: map.mapPos(original.mapPos(selection.head), 1),
        },
        annotations: [
          Transaction.userEvent.of(tr.annotation(Transaction.userEvent)),
          isolateHistory.of('full'),
        ],
      };
    }
    if (!cell && !owner.activeTable?.writing) {
      const separators = [];
      tr.changes.iterChanges((from, _to, newFrom, _newTo, insert) => {
        if (!insert.length) return;
        for (const table of owner.tables) {
          const line = tr.startState.doc.lineAt(from);
          if (
            line.number === tr.startState.doc.lineAt(table.model.to).number + 1 &&
            !line.text.trim() &&
            from > table.model.to
          )
            separators.push(tr.changes.mapPos(line.from, -1));
        }
      });
      if (separators.length) {
        const changes = [...new Set(separators)]
          .sort((a, b) => a - b)
          .map((from) => ({ from, insert: '\n' }));
        const map = tr.newDoc.length;
        const selection = tr.newSelection.main;
        return [
          tr,
          {
            changes,
            sequential: true,
            selection: {
              anchor: Math.min(
                map + changes.length,
                selection.anchor + changes.filter((c) => c.from <= selection.anchor).length,
              ),
              head: Math.min(
                map + changes.length,
                selection.head + changes.filter((c) => c.from <= selection.head).length,
              ),
            },
          },
        ];
      }
    }
    return tr;
  });
}
