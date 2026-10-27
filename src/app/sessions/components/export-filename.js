import { element } from '../../shared/dom.js';

export function createExportFilename(state, id, extension) {
  const input = element('input', {
    className: 'export-filename',
    value: state.fileName(id),
    'aria-label': 'Export filename',
    maxLength: 200,
    spellcheck: false,
  });
  const commit = () => {
    if (input.value !== state.fileName(id)) state.setFileName(id, input.value);
    input.value = state.fileName(id);
  };
  input.addEventListener('blur', commit);
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      commit();
      input.blur();
    } else if (event.key === 'Escape') {
      input.value = state.fileName(id);
      input.blur();
    }
  });
  return {
    element: element(
      'div',
      { className: 'filename-heading' },
      input,
      element('span', { className: 'filename-extension', 'aria-hidden': true }, extension),
    ),
    update() {
      if (document.activeElement !== input) input.value = state.fileName(id);
    },
  };
}
