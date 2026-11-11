import { StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { htmlRoots } from '../functions/html-roots.js';
import { HTMLWidget } from '../components/html-widget.js';
import { inlineSpanActive } from '../functions/inline-format.js';

export function cellPreview() {
  const build = (state) => {
    const ranges = [],
      atomic = [],
      roots = htmlRoots(state.doc, true);
    for (const root of roots) {
      const range = Decoration.replace({
        widget: new HTMLWidget({ ...root, raw: root.raw.replaceAll('\n', '<br>'), block: false }),
      }).range(root.from, root.to);
      ranges.push(range);
      atomic.push(range);
    }
    syntaxTree(state).iterate({
      enter(ref) {
        if (roots.some((root) => ref.from >= root.from && ref.to <= root.to)) return false;
        const styles = {
          StrongEmphasis: 'md-strong',
          Emphasis: 'md-emphasis',
          Strikethrough: 'md-strike',
          InlineCode: 'md-inline-code',
        };
        if (styles[ref.name])
          ranges.push(Decoration.mark({ class: styles[ref.name] }).range(ref.from, ref.to));
        if (
          ['EmphasisMark', 'StrikethroughMark', 'CodeMark'].includes(ref.name) &&
          !inlineSpanActive(ref.node.parent, state.selection.main)
        )
          ranges.push(Decoration.replace({}).range(ref.from, ref.to));
      },
    });
    return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
  };
  return StateField.define({
    create: build,
    update: (value, tr) => (tr.docChanged || tr.selection ? build(tr.state) : value),
    provide: (field) => [
      EditorView.decorations.from(field, (value) => value.decorations),
      EditorView.atomicRanges.of((view) => view.state.field(field).atomic),
    ],
  });
}
