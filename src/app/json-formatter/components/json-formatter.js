import { Compartment, EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab, isolateHistory } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { button, element, message } from '../../shared/dom.js';
import { createNumberedEditor } from '../../shared/numbered-editor.js';
import { toolToolbar } from '../../shared/ui.js';
import { formatJson } from '../functions/format-json.js';

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--accent)' },
  { tag: tags.string, color: 'var(--json-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--json-literal)' },
]);
const indentation = (width) => [indentUnit.of(' '.repeat(width)), EditorState.tabSize.of(width)];

export function createJsonFormatter(state, id) {
  const host = element('div', { className: 'numbered-editor' });
  const error = element('div', { className: 'notice error', role: 'alert', hidden: true });
  let width = state.document(id).options.indentWidth ?? 2;
  const indentationConfig = new Compartment();
  const { editor, setTheme } = createNumberedEditor(host, {
    source: state.document(id).source,
    label: 'JSON editor',
    dark: state.appearance.theme === 'dark',
    extensions: [
      json(),
      syntaxHighlighting(highlight),
      indentationConfig.of(indentation(width)),
      keymap.of([indentWithTab]),
    ],
    changed: (source) => {
      error.hidden = true;
      state.updateSource(id, source);
    },
  });
  const select = element(
    'select',
    { 'aria-label': 'Indentation', className: 'control-field' },
    Array.from({ length: 8 }, (_, index) => {
      const value = index + 1;
      return element('option', { value }, `${value} ${value === 1 ? 'space' : 'spaces'}`);
    }),
  );
  select.value = String(width);
  select.addEventListener('change', () => {
    width = Number(select.value);
    editor.dispatch({ effects: indentationConfig.reconfigure(indentation(width)) });
    state.updateOptions(id, { indentWidth: width });
  });

  function transform(indentWidth) {
    if (state.busy) return;
    const before = editor.state.doc.toString();
    try {
      const after = formatJson(before, indentWidth);
      if (after !== before)
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: after },
          selection: { anchor: Math.min(editor.state.selection.main.head, after.length) },
          annotations: isolateHistory.of('full'),
          scrollIntoView: true,
        });
      error.hidden = true;
      editor.focus();
    } catch (cause) {
      error.textContent =
        cause instanceof SyntaxError ? `Invalid JSON. ${cause.message}` : message(cause);
      error.hidden = false;
    }
  }

  return {
    element: element(
      'section',
      { className: 'tool-view json-formatter', 'aria-label': 'JSON Formatter' },
      toolToolbar(
        'braces',
        element('h1', {}, 'JSON Formatter'),
        select,
        button('One-line', () => transform()),
        button('Format', () => transform(width), { variant: 'primary' }),
      ),
      error,
      host,
    ),
    update: () => setTheme(state.appearance.theme === 'dark'),
    activate: () => editor.requestMeasure(),
    dispose: () => editor.destroy(),
  };
}
