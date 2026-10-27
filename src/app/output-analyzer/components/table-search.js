import { element, button } from '../../shared/dom.js';

export function createTableSearch(initial, total, changed, remember) {
  let timer;
  const input = element('input', {
    type: 'search',
    className: 'table-search-input',
    value: initial,
    'aria-label': 'Search this table',
    placeholder: 'Search this table…',
  });
  const count = element('span', { className: 'search-count', role: 'status' });
  input.addEventListener('input', () => {
    remember(input.value);
    clearTimeout(timer);
    timer = setTimeout(() => changed(input.value), 150);
  });
  const clear = button(
    'Clear',
    () => {
      clearTimeout(timer);
      input.value = '';
      remember('');
      changed('');
      input.focus();
    },
    { 'aria-label': 'Clear table search' },
  );
  const view = element('div', { className: 'table-search' }, input, clear, count);
  return {
    element: view,
    count(value) {
      count.textContent = `${value.toLocaleString()} / ${total.toLocaleString()} rows`;
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
