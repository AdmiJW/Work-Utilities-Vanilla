import { readTextFile } from './read-text-file.js';
import { element } from '../../shared/dom.js';
import { openDialog } from '../../shared/dialog.js';

export function chooseFile(accept) {
  return new Promise((resolve) => {
    const input = element('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

export async function readImportedText(files, extension) {
  if (files.length !== 1)
    throw new Error('Import one file at a time. Your content has not changed.');
  const file = files[0];
  if (!file.name.toLowerCase().endsWith(extension)) throw new Error(`Choose a ${extension} file.`);
  return readTextFile(file);
}

export function chooseImportMode() {
  return new Promise((resolve) => {
    let result = null;
    const dialog = openDialog(
      'Import into current session',
      element('p', {}, 'Replace the current text or insert at the last selection?'),
      [
        { label: 'Cancel', action: (close) => close() },
        {
          label: 'Insert at cursor',
          action: (close) => {
            result = 'insert';
            close();
          },
        },
        {
          label: 'Replace all',
          primary: true,
          action: (close) => {
            result = 'replace';
            close();
          },
        },
      ],
    );
    dialog.addEventListener('close', () => resolve(result), { once: true });
  });
}

export function handleFileDrop(host, importFiles) {
  let depth = 0;
  const isFile = (event) => [...(event.dataTransfer?.types ?? [])].includes('Files');
  const over = (event) => {
    if (isFile(event)) {
      event.preventDefault();
      host.classList.add('file-drag-over');
    }
  };
  const reset = () => {
    depth = 0;
    host.classList.remove('file-drag-over');
  };
  const enter = (event) => {
    if (isFile(event)) {
      depth++;
      over(event);
    }
  };
  const leave = (event) => {
    if (isFile(event) && --depth <= 0) reset();
  };
  const drop = (event) => {
    if (!isFile(event)) return;
    event.preventDefault();
    event.stopPropagation();
    reset();
    if (event.dataTransfer.files.length) void importFiles([...event.dataTransfer.files]);
  };
  host.addEventListener('dragenter', enter);
  host.addEventListener('dragover', over);
  host.addEventListener('dragleave', leave);
  host.addEventListener('drop', drop, true);
  window.addEventListener('dragend', reset);
  window.addEventListener('blur', reset);
  const exit = (event) => {
    if (
      !event.relatedTarget &&
      (event.target === document || event.target === document.documentElement)
    )
      reset();
  };
  window.addEventListener('dragleave', exit);
  window.addEventListener('drop', reset);
  return () => {
    host.removeEventListener('dragenter', enter);
    host.removeEventListener('dragover', over);
    host.removeEventListener('dragleave', leave);
    host.removeEventListener('drop', drop, true);
    window.removeEventListener('dragend', reset);
    window.removeEventListener('blur', reset);
    window.removeEventListener('dragleave', exit);
    window.removeEventListener('drop', reset);
  };
}
