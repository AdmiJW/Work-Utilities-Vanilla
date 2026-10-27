import { element, button, clear, message } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { createExportFilename } from '../../sessions/public-api.js';
import { createSidePanelLayout } from '../../shared/side-panel-layout.js';
import { createUnitTestPanel } from './unit-test-panel.js';
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
  const filename = createExportFilename(state, id, '.sql');
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
      if (mode === 'replace') state.setFileName(id, files[0].name, false);
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
  const stage = element('div', { className: 'sql-stage' });
  const images = createUnitTestPanel(state, id, () =>
    state.updateOptions(id, { unitTestOpen: false }),
  );
  const layout = createSidePanelLayout(stage, host, {
    width: document.options.unitTestWidth,
    label: 'Resize Unit Test panel',
    changed: (unitTestWidth) => state.updateOptions(id, { unitTestWidth }),
  });
  const unitTest = button(
    'Unit Test',
    () => {
      state.updateOptions(id, { unitTestOpen: !state.document(id).options.unitTestOpen });
      if (state.document(id).options.unitTestOpen) images.focus();
    },
    { 'aria-expanded': false },
  );
  const view = element(
    'section',
    { className: 'sql-formatter tool-view', 'aria-label': 'SQL Formatter' },
    element(
      'div',
      { className: 'tool-toolbar' },
      element('div', { className: 'tool-heading' }, icon('code', 19), filename.element),
      element(
        'div',
        { className: 'toolbar-actions' },
        button('Open SQL', async () => {
          const file = await chooseFile('.sql');
          if (file) await importFiles([file]);
        }),
        wrap,
        unitTest,
        button('Prettify', () => format(prettifySql)),
        button('One-line', () => format(formatSqlAsOneLine)),
        button('Export SQL', () => exportSql(editor.text(), state.fileName(id)), {
          className: 'primary',
        }),
      ),
    ),
    notice,
    stage,
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
      filename.update();
      const open = !!state.document(id)?.options.unitTestOpen;
      unitTest.textContent = `Unit Test (${state.document(id)?.unitTestImages?.length ?? 0})`;
      unitTest.setAttribute('aria-expanded', String(open));
      layout.show(open ? images.element : null);
      if (open) images.update();
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
      images.dispose();
      layout.dispose();
      editor.dispose();
      clear(view);
    },
  };
}
