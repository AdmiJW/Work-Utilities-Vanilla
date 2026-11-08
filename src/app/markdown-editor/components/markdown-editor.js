import { element, button, message, clear } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { openDialog, closeDialog } from '../../shared/dialog.js';
import { createExportFilename } from '../../sessions/public-api.js';
import {
  chooseFile,
  chooseImportMode,
  readImportedText,
  handleFileDrop,
  downloadFile,
  copyText,
  sanitizeFileName,
} from '../../file-transfer/public-api.js';
import { createMarkdownEditor } from '../adapters/create-markdown-editor.js';
import { readImageFile, MAX_IMAGE_BYTES } from '../functions/images.js';
import { MAX_DOCUMENT_BYTES, utf8Size, normalize, safeLink } from '../functions/markdown.js';

function textDialog(title, label, value) {
  return new Promise((resolve) => {
    let result = null;
    const input = element('input', { value, 'aria-label': label, className: 'md-dialog-input' });
    const apply = (close) => {
      result = input.value;
      close();
    };
    const dialog = openDialog(title, element('label', {}, label, input), [
      { label: 'Cancel', action: (close) => close() },
      { label: 'Apply', primary: true, action: apply },
    ]);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') apply(() => closeDialog(dialog));
    });
    dialog.addEventListener('close', () => resolve(result), { once: true });
    input.select();
  });
}

export function createMarkdownTool(state, id) {
  let alive = true,
    mode = state.document(id).options.mode ?? 'live';
  const filename = createExportFilename(state, id, '.md');
  const notice = element('div', { className: 'notice error', role: 'alert', hidden: true });
  const host = element('div', { className: 'markdown-host' });
  const editStatus = element('div', {
    className: 'md-edit-status',
    role: 'status',
    'aria-live': 'polite',
    hidden: true,
  });
  let statusTimer;
  const notify = (text) => {
    clearTimeout(statusTimer);
    editStatus.textContent = text;
    editStatus.hidden = false;
    statusTimer = setTimeout(() => {
      editStatus.hidden = true;
    }, 4000);
  };
  host.append(editStatus);
  const findButton = button('Find', () => editor.find(), { 'aria-expanded': false });
  const fail = (error) => {
    if (alive) {
      notice.textContent = message(error);
      notice.hidden = false;
    }
  };
  const sizeCheck = (text) => {
    if (utf8Size(text) > MAX_DOCUMENT_BYTES)
      throw new Error(
        'New imports and image insertions must fit within 20 MiB of Markdown. Export or remove content before adding more.',
      );
  };
  const editor = createMarkdownEditor(
    host,
    state.document(id).source,
    { ...state.document(id).options, dark: state.appearance.theme === 'dark' },
    {
      changed: (source) => state.updateSource(id, source),
      notify,
      validateInsertion: (source) => sizeCheck(editor.serialized(source)),
      viewChanged: (options) => state.updateOptions(id, options),
      link: () => void addLink(),
      paste: (event) => {
        if (editor.reading) return false;
        const files = [...(event.clipboardData?.items ?? [])]
          .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
          .map((item) => item.getAsFile())
          .filter(Boolean);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
      imageAction: (action, parts, range) => void imageAction(action, parts, range),
      searchChanged: (open) => findButton?.setAttribute('aria-expanded', String(open)),
    },
  );

  async function addLink() {
    if (editor.reading) return;
    const url = await textDialog('Insert link', 'Link URL', 'https://');
    if (url === null || !alive) return;
    if (!safeLink(url)) {
      fail(new Error('Use an https://, http://, or mailto: link.'));
      return;
    }
    editor.format('link', url);
  }

  async function imageAction(action, parts, range) {
    if (editor.reading) return;
    const mark = editor.bookmark(range);
    try {
      if (action === 'remove') editor.insert('', mark);
      else if (action === 'alt') {
        const alt = await textDialog('Image alt text', 'Alt text', parts.label);
        if (alt !== null && alive && mark.valid)
          editor.insert(
            `![${alt.replace(/[\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ')}](${parts.url})`,
            mark,
          );
      } else {
        const file = await chooseFile('image/png,image/jpeg,.png,.jpg,.jpeg');
        if (file && alive && mark.valid) await insertImages([file], mark);
      }
    } catch (error) {
      fail(error);
    } finally {
      editor.release(mark);
    }
  }

  async function insertImages(files, range) {
    if (!alive || state.busy || editor.reading) return;
    const mark = editor.bookmark(range ?? editor.selection());
    try {
      if (files.some((file) => file.size > MAX_IMAGE_BYTES))
        throw new Error('Each image must be at most 5 MiB.');
      if (files.reduce((sum, file) => sum + 4 * Math.ceil(file.size / 3), 0) > MAX_DOCUMENT_BYTES)
        throw new Error('The image batch exceeds 20 MiB of Markdown.');
      const values = [];
      for (const file of files) {
        values.push((await readImageFile(file)).markdown);
        if (!alive || !mark.valid || state.busy) return;
      }
      const insert = values.join('\n\n');
      const current = normalize(editor.text());
      sizeCheck(editor.serialized(current.slice(0, mark.from) + insert + current.slice(mark.to)));
      if (editor.insert(insert, mark, true)) notice.hidden = true;
    } catch (error) {
      fail(error);
    } finally {
      editor.release(mark);
    }
  }

  async function importFiles(files) {
    if (!alive || editor.reading) return;
    const mark = editor.bookmark();
    try {
      if (files.length === 1 && files[0].size > MAX_DOCUMENT_BYTES * 2)
        throw new Error('The Markdown file is too large. The document limit is 20 MiB.');
      const value = await readImportedText(files, ['.md', '.markdown', '.txt']);
      sizeCheck(value);
      if (!alive || !mark.valid || state.busy) return;
      const action = editor.text() ? await chooseImportMode() : 'replace';
      if (!action || !alive || !mark.valid || state.busy || editor.reading) return;
      if (action === 'replace') {
        editor.replace(value);
        state.setFileName(id, files[0].name, false);
      } else {
        const text = normalize(editor.text());
        sizeCheck(editor.serialized(text.slice(0, mark.from) + value + text.slice(mark.to)));
        editor.insert(value, mark, true);
      }
      notice.hidden = true;
      editor.focus();
    } catch (error) {
      fail(error);
    } finally {
      editor.release(mark);
    }
  }

  const modes = element('div', {
    className: 'md-modes',
    role: 'group',
    'aria-label': 'Markdown view mode',
  });
  const formatBar = element('div', {
    className: 'md-formatting',
    role: 'toolbar',
    'aria-label': 'Markdown formatting',
  });
  const editable = [];
  for (const [value, label] of [
    ['live', 'Live Preview'],
    ['source', 'Source'],
    ['reading', 'Reading'],
  ])
    modes.append(
      button(
        label,
        () => {
          editor.setMode(value);
          mode = value;
          state.updateOptions(id, { mode: value });
          update();
        },
        { 'aria-pressed': mode === value },
      ),
    );
  const formatButtons = [
    ['B', 'bold', 'Bold'],
    ['I', 'italic', 'Italic'],
    ['S', 'strike', 'Strikethrough'],
    ['Link', 'link', 'Insert link'],
    ['• List', 'bullet', 'Bullet list'],
    ['1. List', 'numbered', 'Numbered list'],
    ['☑ Tasks', 'task', 'Task list'],
    ['Quote', 'quote', 'Blockquote'],
    ['Code', 'code', 'Inline code'],
    ['Code block', 'fence', 'Code block'],
    ['Table', 'table', 'Insert table'],
    ['Divider', 'divider', 'Divider'],
  ];
  const heading = element(
    'select',
    { 'aria-label': 'Heading level' },
    element('option', { value: '' }, 'Heading'),
    ...[1, 2, 3, 4, 5, 6].map((level) => element('option', { value: level }, `Heading ${level}`)),
  );
  heading.addEventListener('change', () => {
    if (heading.value && !editor.format('heading', heading.value))
      fail(new Error('Press Escape to leave the table cell before adding a heading.'));
    heading.value = '';
  });
  formatBar.append(heading);
  for (const [label, command, accessible] of formatButtons) {
    const control = button(
      label,
      () => {
        if (command === 'link') void addLink();
        else if (!editor.format(command))
          fail(
            new Error(
              'Table cells support inline formatting. Press Escape to insert document blocks.',
            ),
          );
      },
      { 'aria-label': accessible, title: accessible },
    );
    control.addEventListener('mousedown', (event) => event.preventDefault());
    formatBar.append(control);
  }
  const open = button('Open Markdown', async () => {
    const file = await chooseFile('.md,.markdown,.txt');
    if (file) await importFiles([file]);
  });
  const image = button('Add image', async () => {
    const file = await chooseFile('image/png,image/jpeg,.png,.jpg,.jpeg');
    if (file) await insertImages([file]);
  });
  editable.push(open, image);
  const wide = button(
    'Wide',
    () => state.updateOptions(id, { wide: !state.document(id).options.wide }),
    { 'aria-pressed': false },
  );
  const view = element(
    'section',
    { className: 'markdown-tool tool-view', 'aria-label': 'Markdown Editor' },
    element(
      'div',
      { className: 'tool-toolbar' },
      element('div', { className: 'tool-heading' }, icon('markdown', 19), filename.element),
      element(
        'div',
        { className: 'toolbar-actions' },
        open,
        image,
        button('Copy Markdown', () => void copyText(editor.text()).catch(fail)),
        button(
          'Export Markdown',
          () =>
            downloadFile(
              editor.text(),
              sanitizeFileName(state.fileName(id), '.md'),
              'text/markdown;charset=utf-8',
            ),
          { className: 'primary' },
        ),
      ),
    ),
    element(
      'div',
      { className: 'md-view-toolbar' },
      modes,
      element('div', { className: 'toolbar-actions' }, wide, findButton),
    ),
    formatBar,
    notice,
    host,
    element(
      'div',
      { className: 'editor-hint' },
      'Markdown · Stored on this device',
      element('span', {}, 'Ctrl+B Bold · Ctrl+I Italic · Ctrl+F Find · Ctrl+Z Undo'),
    ),
  );
  const stopDrop = handleFileDrop(host, (files) => {
    if (editor.reading) return;
    if (files.every((file) => file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name)))
      void insertImages(files);
    else void importFiles(files);
  });
  function update() {
    if (!alive) return;
    const doc = state.document(id);
    if (!doc) return;
    filename.update();
    view.classList.toggle('md-wide', !!doc.options.wide);
    wide.setAttribute('aria-pressed', String(!!doc.options.wide));
    for (const control of modes.children)
      control.setAttribute(
        'aria-pressed',
        String(
          control.textContent ===
            { live: 'Live Preview', source: 'Source', reading: 'Reading' }[mode],
        ),
      );
    formatBar.hidden = mode === 'reading';
    editable.forEach((control) => (control.disabled = mode === 'reading'));
    host.dataset.mode = mode;
    editor.setTheme(state.appearance.theme === 'dark');
    if (editor.text() !== doc.source) editor.replace(doc.source);
  }
  return {
    element: view,
    update,
    activate: () => editor.editor.requestMeasure(),
    dispose() {
      clearTimeout(statusTimer);
      alive = false;
      stopDrop();
      editor.dispose();
      clear(view);
    },
  };
}
