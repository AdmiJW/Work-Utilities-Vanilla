import { element, button, clear, message } from '../../shared/dom.js';
import { openDialog } from '../../shared/dialog.js';
import { BackgroundTask } from '../../shared/background-task.js';
import { encodeBase64 } from '../../shared/image-data.js';
import { downloadFile, sanitizeFileName, handleFileDrop } from '../../file-transfer/public-api.js';
import { readScreenshot } from '../adapters/read-screenshot.js';
import { exportUnitTest } from '../functions/export-unit-test.js';

export function createUnitTestPanel(state, id, closed) {
  let alive = true;
  let signature = '';
  let sequence = 0;
  let exporting = false;
  const urls = new Map();
  const references = () => state.document(id)?.unitTestImages ?? [];
  const task = new BackgroundTask('unit-test', exportUnitTest);
  const notice = element('p', { className: 'notice error', role: 'alert', hidden: true });
  const fail = (error) => {
    notice.textContent = message(error);
    notice.hidden = false;
  };
  const list = element('div', { className: 'screenshot-list' });
  const input = element('input', {
    type: 'file',
    accept: 'image/png,image/jpeg',
    multiple: true,
    hidden: true,
    'aria-label': 'Screenshot files',
  });
  const importImages = async (files) => {
    try {
      const images = await Promise.all(files.map(readScreenshot));
      if (!alive || state.busy) return;
      state.images.add(id, images);
      notice.hidden = true;
    } catch (error) {
      if (alive) fail(error);
    }
  };
  input.addEventListener('change', () => {
    void importImages([...input.files]);
    input.value = '';
  });
  const exportButton = button(
    'Export Unit Test',
    async () => {
      if (exporting || !references().length) return;
      exporting = true;
      update();
      notice.hidden = true;
      const fileName = sanitizeFileName(state.fileName(id), '.sql').slice(0, -4);
      try {
        const images = await Promise.all(
          references().map(async (reference) => {
            const { blob } = await state.images.read(reference.id);
            return { ...reference, data: encodeBase64(new Uint8Array(await blob.arrayBuffer())) };
          }),
        );
        const buffer = await task.run({ images });
        if (alive)
          downloadFile(
            buffer,
            sanitizeFileName(`UT-${fileName}`, '.xlsx'),
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          );
      } catch (error) {
        if (alive && error.name !== 'AbortError') fail(error);
      } finally {
        exporting = false;
        if (alive) update();
      }
    },
    { className: 'primary' },
  );
  const panel = element(
    'aside',
    {
      className: 'unit-test-panel',
      tabIndex: 0,
      role: 'region',
      'aria-label': 'Unit Test screenshots',
    },
    element(
      'header',
      {},
      element('h2', {}, 'Unit Test'),
      button('×', closed, { className: 'icon-button', 'aria-label': 'Close Unit Test panel' }),
    ),
    element(
      'p',
      { className: 'hint' },
      'Paste a screenshot here with Ctrl+V, drop images, or upload PNG/JPEG files.',
    ),
    element(
      'div',
      { className: 'screenshot-actions' },
      button('Add images', () => input.click()),
      exportButton,
    ),
    input,
    notice,
    list,
  );
  panel.addEventListener('paste', (event) => {
    const images = [...(event.clipboardData?.items ?? [])]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (images.length) {
      event.preventDefault();
      void importImages(images);
    }
  });
  const stopDrop = handleFileDrop(panel, importImages);

  async function renderImages(images) {
    const request = ++sequence;
    clear(
      list,
      element(
        'p',
        { className: 'hint' },
        images.length ? 'Loading screenshots…' : 'No screenshots yet.',
      ),
    );
    try {
      const cards = await Promise.all(
        images.map(async (image, index) => {
          const { blob } = await state.images.read(image.id);
          if (!alive || request !== sequence) return null;
          let url = urls.get(image.id);
          if (!url) {
            url = URL.createObjectURL(blob);
            urls.set(image.id, url);
          }
          const move = (direction) => {
            const ids = references().map((value) => value.id);
            const current = ids.indexOf(image.id);
            [ids[current], ids[current + direction]] = [ids[current + direction], ids[current]];
            state.images.reorder(id, ids);
          };
          return element(
            'article',
            { className: 'screenshot-card', dataset: { imageId: image.id } },
            button(
              element('img', {
                src: url,
                alt: `Screenshot ${index + 1}: ${image.name}`,
                draggable: false,
              }),
              () => {
                openDialog(
                  'Screenshot preview',
                  element('img', { src: url, alt: image.name, className: 'screenshot-preview' }),
                );
              },
              {
                className: 'screenshot-thumbnail',
                'aria-label': `Preview screenshot ${index + 1}`,
              },
            ),
            element(
              'div',
              { className: 'screenshot-description' },
              element('strong', {}, image.name),
              element('span', {}, `${image.width} × ${image.height} px`),
            ),
            element(
              'div',
              { className: 'screenshot-actions' },
              button('↑', () => move(-1), {
                disabled: index === 0,
                'aria-label': `Move screenshot ${index + 1} up`,
              }),
              button('↓', () => move(1), {
                disabled: index === images.length - 1,
                'aria-label': `Move screenshot ${index + 1} down`,
              }),
              button(
                'Remove',
                () =>
                  state.images.reorder(
                    id,
                    references()
                      .filter((value) => value.id !== image.id)
                      .map((value) => value.id),
                  ),
                { 'aria-label': `Remove screenshot ${index + 1}` },
              ),
            ),
          );
        }),
      );
      if (alive && request === sequence && images.length) clear(list, cards);
    } catch (error) {
      if (alive && request === sequence) fail(error);
    }
  }
  function update() {
    exportButton.disabled = exporting || !references().length;
    exportButton.textContent = exporting ? 'Exporting…' : 'Export Unit Test';
    const key = JSON.stringify(references());
    if (signature === key) return;
    signature = key;
    for (const [id, url] of urls)
      if (!references().some((image) => image.id === id)) {
        URL.revokeObjectURL(url);
        urls.delete(id);
      }
    void renderImages([...references()]);
  }
  return {
    element: panel,
    update,
    focus: () => panel.focus(),
    dispose() {
      alive = false;
      sequence++;
      stopDrop();
      task.cancel();
      for (const url of urls.values()) URL.revokeObjectURL(url);
    },
  };
}
