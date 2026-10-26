import { element, button, clear, message } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import {
  chooseFile,
  chooseImportMode,
  readImportedText,
  handleFileDrop,
  exportSql,
} from '../../file-transfer/public-api.js';
import { createSqlEditor } from '../adapters/create-sql-editor.js';
import { prettifySql } from '../functions/prettify-sql.js';
import { formatSqlAsOneLine } from '../functions/format-sql-as-one-line.js';

export function createSqlFormatter(state, id) {
  const heading = element('h1');
  const notice = element('div', { role: 'alert', className: 'notice error', hidden: true });
  const host = element('div', { className: 'sql-editor' });
  const document = state.document(id);
  const editor = createSqlEditor(
    host,
    document.source,
    { ...document.options, dark: state.appearance.theme === 'dark' },
    (source) => state.updateSource(id, source),
    (options) => state.updateOptions(id, options),
  );
  let wrapped = !!document.options.wordWrap;
  let dark = state.appearance.theme === 'dark';
  let alive = true;
  const format = (formatter) => {
    try {
      editor.replace(formatter(editor.text()), false);
      notice.hidden = true;
      editor.focus();
    } catch (error) {
      notice.textContent = message(error);
      notice.hidden = false;
    }
  };
  const importFiles = async (files) => {
    const selection = editor.selection();
    try {
      const value = await readImportedText(files, '.sql');
      if (!alive) return;
      const mode = editor.text() ? await chooseImportMode() : 'replace';
      if (!mode || !alive) return;
      if (mode === 'replace') editor.replace(value);
      else editor.insert(value, selection);
      notice.hidden = true;
      editor.focus();
    } catch (error) {
      notice.textContent = message(error);
      notice.hidden = false;
    }
  };
  const wrap = button(
    'Word Wrap',
    () => {
      wrapped = !wrapped;
      editor.setWrap(wrapped);
      state.updateOptions(id, { wordWrap: wrapped });
    },
    { 'aria-pressed': wrapped },
  );
  const view = element(
    'section',
    { className: 'sql-formatter tool-view', 'aria-label': 'SQL Formatter' },
    element(
      'div',
      { className: 'tool-toolbar' },
      element('div', { className: 'tool-heading' }, icon('code', 19), heading),
      element(
        'div',
        { className: 'toolbar-actions' },
        button('Open SQL', async () => {
          const file = await chooseFile('.sql');
          if (file) await importFiles([file]);
        }),
        wrap,
        button('Prettify', () => format(prettifySql)),
        button('One-line', () => format(formatSqlAsOneLine)),
        button(
          'Export SQL',
          () => exportSql(editor.text(), state.summaries.find((item) => item.id === id).name),
          { className: 'primary' },
        ),
      ),
    ),
    notice,
    host,
    element(
      'div',
      { className: 'editor-hint' },
      'Transact-SQL',
      element('span', {}, 'Ctrl+F Find · Ctrl+H Replace · Ctrl+Z Undo · 4 spaces'),
    ),
  );
  const stopDrop = handleFileDrop(host, importFiles);
  return {
    element: view,
    update() {
      heading.textContent = state.summaries.find((item) => item.id === id)?.name ?? '';
      wrap.setAttribute('aria-pressed', String(wrapped));
      if (dark !== (state.appearance.theme === 'dark')) {
        dark = !dark;
        editor.setTheme(dark);
      }
      if (editor.text() !== state.document(id)?.source)
        editor.replace(state.document(id)?.source ?? '');
    },
    activate() {
      editor.editor.requestMeasure();
    },
    dispose() {
      alive = false;
      stopDrop();
      editor.dispose();
      clear(view);
    },
  };
}
