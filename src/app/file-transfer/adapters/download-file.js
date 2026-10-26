import { element } from '../../shared/dom.js';
import { openDialog } from '../../shared/dialog.js';
import { sanitizeFileName } from '../functions/sanitize-file-name.js';

export function downloadFile(contents, name, type = 'text/plain;charset=utf-8') {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = element('a', { href: url, download: name });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function exportSql(source, name) {
  downloadFile(source, sanitizeFileName(name, '.sql'));
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* A managed browser may deny clipboard access. */
  }
  const value = element('textarea', {
    value: text,
    readOnly: true,
    'aria-label': 'Text to copy',
    rows: 8,
    wrap: 'off',
  });
  openDialog(
    'Copy text',
    element('div', {}, element('p', {}, 'Press Ctrl+C to copy the selected text.'), value),
    [{ label: 'Done', action: (close) => close() }],
  );
  value.focus();
  value.select();
}
