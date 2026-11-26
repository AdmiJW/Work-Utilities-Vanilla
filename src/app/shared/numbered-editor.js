import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

export function createNumberedEditor(host, { source, label, dark, extensions = [], changed }) {
  const theme = new Compartment();
  const editor = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: source,
      extensions: [
        history(),
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
        theme.of(EditorView.theme({}, { dark })),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changed(update.state.doc.toString());
        }),
        extensions,
      ],
    }),
  });
  return {
    editor,
    setTheme(value) {
      if (value === dark) return;
      dark = value;
      editor.dispatch({ effects: theme.reconfigure(EditorView.theme({}, { dark })) });
    },
  };
}
