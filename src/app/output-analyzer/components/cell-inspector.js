import { element, button, clear, message } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { copyText } from '../../file-transfer/public-api.js';
import { BackgroundTask } from '../../shared/background-task.js';
import { inspectValue } from '../functions/inspect-value.js';
import { renderJsonTree } from './json-tree.js';

export function createCellInspector(initialMode, modeChanged, closed) {
  let cell = null;
  let mode = initialMode ?? 'shallow';
  let view = 'tree';
  let rawExpanded = true;
  let lens = [];
  let current = null;
  const task = new BackgroundTask('inspect', inspectValue);
  const name = element('h3');
  const position = element('p');
  const raw = element('textarea', {
    className: 'raw-value mono',
    readOnly: true,
    'aria-label': 'Raw cell value',
    wrap: 'off',
  });
  const copyStatus = element('p', { className: 'copy-status', role: 'status', hidden: true });
  const copy = async (value) => {
    try {
      await copyText(value);
      copyStatus.textContent = 'Copy requested';
    } catch (error) {
      copyStatus.textContent = message(error);
    }
    copyStatus.hidden = false;
  };
  const rawToggle = button(
    'Raw value',
    () => {
      rawExpanded = !rawExpanded;
      raw.hidden = !rawExpanded;
      rawToggle.setAttribute('aria-expanded', String(rawExpanded));
    },
    { className: 'raw-toggle eyebrow', 'aria-expanded': true },
  );
  const tree = element('div', { className: 'tree-body' });
  const pretty = element('textarea', {
    className: 'pretty-value mono',
    readOnly: true,
    'aria-label': 'Prettified JSON',
    wrap: 'off',
    hidden: true,
  });
  const hint = element('p', { className: 'inspection-hint' });
  const notice = element('p', { className: 'inspection-hint', hidden: true });
  const breadcrumb = element('div', { className: 'nested-breadcrumb', hidden: true });
  const setView = (value) => {
    view = value;
    render();
  };
  const treeButton = button('Tree', () => setView('tree'), { 'aria-pressed': true });
  const prettyButton = button('Pretty', () => setView('pretty'), { 'aria-pressed': false });
  const json = element(
    'section',
    { className: 'json-section' },
    element(
      'div',
      { className: 'json-heading' },
      element('span', {}, icon('braces', 14), 'JSON inspection'),
      element('div', { className: 'view-toggle' }, treeButton, prettyButton),
    ),
    breadcrumb,
    notice,
    hint,
    tree,
    pretty,
    element(
      'div',
      { className: 'pretty-controls' },
      button('Copy JSON', () => copy(current?.inspection.pretty ?? ''), {
        className: 'copy-button',
      }),
    ),
  );
  const chooseMode = (value) => {
    if (value !== mode) {
      mode = value;
      lens = [];
      modeChanged(value);
      void inspect();
    }
  };
  const shallow = button('Shallow', () => chooseMode('shallow'));
  const deep = button('Deep', () => chooseMode('deep'));
  const panel = element(
    'aside',
    { className: 'inspector', tabIndex: 0, role: 'region', 'aria-label': 'Cell inspector' },
    element(
      'header',
      { className: 'inspector-header' },
      element(
        'div',
        {},
        element('span', { className: 'eyebrow' }, 'Cell inspector'),
        name,
        position,
      ),
      button('×', closed, { className: 'icon-button', 'aria-label': 'Close cell inspector' }),
    ),
    element(
      'div',
      { className: 'raw-heading' },
      rawToggle,
      button('Copy raw', () => copy(cell?.value ?? ''), {
        className: 'copy-button',
        'aria-label': 'Copy raw value',
      }),
    ),
    raw,
    copyStatus,
    element(
      'div',
      { className: 'decode-controls', role: 'group', 'aria-label': 'JSON decoding' },
      shallow,
      deep,
    ),
    json,
  );

  function render() {
    shallow.setAttribute('aria-pressed', String(mode === 'shallow'));
    deep.setAttribute('aria-pressed', String(mode === 'deep'));
    treeButton.setAttribute('aria-pressed', String(view === 'tree'));
    prettyButton.setAttribute('aria-pressed', String(view === 'pretty'));
    treeButton.classList.toggle('active', view === 'tree');
    prettyButton.classList.toggle('active', view === 'pretty');
    const valid = !!current?.inspection.valid;
    hint.hidden = valid;
    if (current && !valid)
      hint.textContent =
        current.inspection.error || 'This cell does not contain a JSON object or array.';
    tree.hidden = !valid || view !== 'tree';
    pretty.hidden = !valid || view !== 'pretty';
    pretty.value = current?.inspection.pretty ?? '';
    notice.hidden = !current?.notice;
    notice.textContent = current?.notice ?? '';
    breadcrumb.hidden = lens.length === 0;
    clear(
      breadcrumb,
      button('← Back', () => {
        lens.pop();
        void inspect();
      }),
      element('span', {}, `Decoded string · depth ${lens.length}`),
    );
  }

  async function inspect() {
    if (!cell) return;
    current = null;
    hint.textContent = 'Inspecting JSON…';
    render();
    try {
      current = await task.run({ source: lens.at(-1) ?? cell.value, mode });
      clear(
        tree,
        current.inspection.root
          ? renderJsonTree(current.inspection.root, current.source, (value) => {
              lens.push(value);
              void inspect();
            })
          : null,
      );
      render();
    } catch (error) {
      if (error.name !== 'AbortError') {
        hint.hidden = false;
        hint.textContent = message(error);
      }
    }
  }

  return {
    element: panel,
    setCell(value) {
      if (
        cell?.columnName === value.columnName &&
        cell?.rowNumber === value.rowNumber &&
        cell?.value === value.value
      )
        return;
      cell = value;
      lens = [];
      name.textContent = value.columnName;
      position.textContent = `Source line ${value.rowNumber}`;
      raw.value = value.value;
      copyStatus.hidden = true;
      void inspect();
    },
    setMode(value) {
      if (value && value !== mode) {
        mode = value;
        lens = [];
        void inspect();
      }
    },
    dispose() {
      task.cancel();
    },
  };
}
