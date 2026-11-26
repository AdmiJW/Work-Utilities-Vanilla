import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';

export const setDiffDecorations = StateEffect.define();
export const diffDecorations = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    if (transaction.docChanged) return Decoration.none;
    return transaction.effects.find((effect) => effect.is(setDiffDecorations))?.value ?? value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const diffLineHeight = 22;

class AlignmentSpace extends WidgetType {
  constructor(lines) {
    super();
    this.lines = lines;
  }

  eq(other) {
    return this.lines === other.lines;
  }

  get estimatedHeight() {
    return this.lines * diffLineHeight;
  }

  toDOM() {
    const space = document.createElement('div');
    space.className = 'diff-alignment-space';
    space.setAttribute('aria-hidden', 'true');
    space.style.height = `${this.estimatedHeight}px`;
    return space;
  }
}

const lineStyles = ['removed', 'added'].map((type) => Decoration.line({ class: `diff-${type}` }));
const textStyles = ['removed', 'added'].map((type) =>
  Decoration.mark({ class: `diff-${type}-text` }),
);

function lineRange(doc, from, to) {
  const first = doc.lineAt(from).number;
  const count = to > from ? doc.lineAt(Math.min(to - 1, doc.length)).number - first + 1 : 0;
  return { first, count };
}

export function diffRanges(chunks, docs) {
  const ranges = [[], []];
  for (const chunk of chunks) {
    const starts = [chunk.fromA, chunk.fromB];
    const ends = [chunk.toA, chunk.toB];
    const lines = docs.map((doc, side) => lineRange(doc, starts[side], ends[side]));
    for (const [side, doc] of docs.entries()) {
      const { first, count } = lines[side];
      if (doc.length)
        for (let number = first; number < first + count; number++)
          ranges[side].push(lineStyles[side].range(doc.line(number).from));
      for (const change of chunk.changes) {
        const from = starts[side] + (side === 0 ? change.fromA : change.fromB);
        const to = starts[side] + (side === 0 ? change.toA : change.toB);
        if (from < to) ranges[side].push(textStyles[side].range(from, to));
      }
      const missing = lines[1 - side].count - count;
      if (missing > 0) {
        const end = ends[side];
        const space = Decoration.widget({
          widget: new AlignmentSpace(missing),
          block: true,
          side: end > doc.length ? 1 : -1,
        });
        ranges[side].push(space.range(Math.min(end, doc.length)));
      }
    }
  }
  return ranges.map((side) => Decoration.set(side, true));
}
