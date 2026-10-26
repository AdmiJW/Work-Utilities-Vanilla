import { element, button } from '../../shared/dom.js';
import {
  chooseFile,
  chooseImportMode,
  readImportedText,
  handleFileDrop,
  createTextareaEditor,
} from '../../file-transfer/public-api.js';

export function createSourceInput(state, id, failed, imported) {
  const doc = () => state.document(id);
  let alive = true;
  let selection = { start: 0, end: 0 };
  const source = element('textarea', {
    className: 'source-input mono',
    'aria-label': 'Execution output',
    spellcheck: false,
    wrap: 'off',
    placeholder: 'Paste DER/DPR execution output or open a TXT file…',
    value: doc().source,
  });
  const rememberSelection = () => {
    selection = { start: source.selectionStart, end: source.selectionEnd };
  };
  for (const event of ['select', 'keyup', 'click', 'blur'])
    source.addEventListener(event, rememberSelection);
  const editor = createTextareaEditor(
    source,
    (value) => {
      state.updateSource(id, value);
      rememberSelection();
    },
    doc().source,
  );
  const size = element('span', { className: 'source-size mono' });
  const toggle = button(
    'Source output',
    () => state.updateOptions(id, { inputCollapsed: !doc().options.inputCollapsed }),
    { className: 'source-toggle eyebrow', 'aria-expanded': true },
  );
  const importFiles = async (files) => {
    const capturedSelection = { ...selection };
    try {
      const value = await readImportedText(files, '.txt');
      if (!alive) return;
      const mode = source.value ? await chooseImportMode() : 'replace';
      if (!mode || !alive) return;
      state.updateOptions(id, { inputCollapsed: false });
      editor.replace(value, mode, capturedSelection);
      imported();
    } catch (error) {
      if (alive) failed(error);
    }
  };
  const section = element(
    'section',
    { className: 'source-section' },
    element(
      'div',
      { className: 'source-heading' },
      toggle,
      size,
      button('Open TXT', async () => {
        const file = await chooseFile('.txt');
        if (file && alive) await importFiles([file]);
      }),
    ),
    source,
  );
  const stopDrop = handleFileDrop(section, importFiles);
  return {
    element: section,
    update() {
      source.hidden = !!doc().options.inputCollapsed;
      toggle.setAttribute('aria-expanded', String(!source.hidden));
      size.textContent = `${doc().source.length.toLocaleString()} characters`;
      editor.sync(doc().source);
    },
    dispose() {
      alive = false;
      editor.dispose();
      stopDrop();
    },
  };
}
