import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import {
  history,
  historyKeymap,
  defaultKeymap,
  indentWithTab,
  invertedEffects,
  isolateHistory,
} from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
  indentUnit,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { sql, MSSQL } from '@codemirror/lang-sql';

const lineEndingEffect = StateEffect.define();
const lineEnding = StateField.define({
  create: () => '\n',
  update: (value, transaction) =>
    transaction.effects.find((effect) => effect.is(lineEndingEffect))?.value ?? value,
});
const detectEnding = (source) => (source.includes('\r\n') ? '\r\n' : '\n');
const normalize = (source) => source.replace(/\r\n?/g, '\n');

export function createSqlEditor(host, source, options, changed, viewChanged) {
  const wrapping = new Compartment();
  const appearance = new Compartment();
  const length = normalize(source).length;
  const position = (value) => (Number.isInteger(value) ? Math.max(0, Math.min(length, value)) : 0);
  const editor = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: normalize(source),
      selection: {
        anchor: position(options.selection?.anchor),
        head: position(options.selection?.head ?? options.selection?.anchor),
      },
      extensions: [
        lineEnding.init(() => detectEnding(source)),
        invertedEffects.of((transaction) =>
          transaction.effects.some((effect) => effect.is(lineEndingEffect))
            ? [lineEndingEffect.of(transaction.startState.field(lineEnding))]
            : [],
        ),
        history(),
        lineNumbers(),
        foldGutter(),
        highlightActiveLine(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        sql({ dialect: MSSQL }),
        syntaxHighlighting(defaultHighlightStyle),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', spellcheck: 'false' }),
        wrapping.of(options.wordWrap ? EditorView.lineWrapping : []),
        appearance.of(EditorView.theme({}, { dark: options.dark })),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet || update.docChanged)
            host.classList.toggle('has-selection', !update.state.selection.main.empty);
          if (
            update.docChanged ||
            update.transactions.some((transaction) =>
              transaction.effects.some((effect) => effect.is(lineEndingEffect)),
            )
          )
            changed(text());
          if (update.selectionSet)
            viewChanged({
              selection: {
                anchor: update.state.selection.main.anchor,
                head: update.state.selection.main.head,
              },
            });
        }),
      ],
    }),
  });
  const text = () => editor.state.doc.toString().replaceAll('\n', editor.state.field(lineEnding));
  host.classList.toggle('has-selection', !editor.state.selection.main.empty);
  editor.scrollDOM.scrollTop = options.scrollTop ?? 0;
  const scroll = () => viewChanged({ scrollTop: editor.scrollDOM.scrollTop });
  editor.scrollDOM.addEventListener('scroll', scroll);
  return {
    editor,
    text,
    replace(value, adoptEnding = true) {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: normalize(value) },
        effects: adoptEnding ? lineEndingEffect.of(detectEnding(value)) : [],
        annotations: isolateHistory.of('full'),
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    },
    selection() {
      return { from: editor.state.selection.main.from, to: editor.state.selection.main.to };
    },
    insert(value, selection = this.selection()) {
      editor.dispatch({
        changes: { from: selection.from, to: selection.to, insert: normalize(value) },
        annotations: isolateHistory.of('full'),
        selection: { anchor: selection.from + normalize(value).length },
      });
      editor.focus();
    },
    setWrap(value) {
      editor.dispatch({ effects: wrapping.reconfigure(value ? EditorView.lineWrapping : []) });
    },
    setTheme(dark) {
      editor.dispatch({ effects: appearance.reconfigure(EditorView.theme({}, { dark })) });
    },
    focus() {
      editor.focus();
      editor.requestMeasure();
    },
    dispose() {
      editor.scrollDOM.removeEventListener('scroll', scroll);
      editor.destroy();
    },
  };
}
