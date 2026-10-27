import { element, button, clear } from '../../shared/dom.js';
import { openDialog } from '../../shared/dialog.js';
import { debugCases, debugScreenshots } from '../functions/debug-cases.js';

export function openDebugDialog(state) {
  const cases = debugCases();
  let selected = 'sql-formatter';
  let opening = false;
  const list = element('div', { className: 'debug-cases' });
  const error = element('p', { role: 'alert', className: 'notice error', hidden: true });
  const groups = element('nav', { className: 'debug-groups', 'aria-label': 'Debug tools' });
  const groupButtons = ['sql-formatter', 'output-analyzer'].map((toolId) =>
    button(
      toolId === 'sql-formatter' ? 'SQL Formatter' : 'Output Analyzer',
      () => {
        selected = toolId;
        render();
      },
      { 'aria-pressed': selected === toolId },
    ),
  );
  groups.append(...groupButtons);
  const dialog = openDialog(
    'Debug cases',
    element('div', { className: 'debug-layout' }, groups, element('div', {}, error, list)),
  );
  dialog.classList.add('debug-dialog');
  const open = async (testCase) => {
    if (opening || state.busy) return;
    opening = true;
    list.inert = true;
    error.hidden = true;
    try {
      const images = testCase.screenshots ? await debugScreenshots() : [];
      if (!dialog.open) return;
      const id = await state.create(testCase.toolId, `Debug · ${testCase.title}`, testCase.source, {
        fileBaseName: testCase.fileBaseName,
        images,
        options: {
          ...testCase.options,
          ...(testCase.toolId === 'output-analyzer'
            ? { analyzed: true, inputCollapsed: true }
            : {}),
        },
      });
      if (id) dialog.close();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      opening = false;
      list.inert = false;
    }
  };
  function render() {
    groupButtons.forEach((button, index) =>
      button.setAttribute(
        'aria-pressed',
        String(selected === (index === 0 ? 'sql-formatter' : 'output-analyzer')),
      ),
    );
    clear(
      list,
      cases
        .filter((testCase) => testCase.toolId === selected)
        .map((testCase) =>
          button(
            [element('strong', {}, testCase.title), element('span', {}, testCase.description)],
            () => open(testCase),
            { className: 'debug-case', 'aria-label': `Open debug case ${testCase.title}` },
          ),
        ),
    );
  }
  render();
  return dialog;
}
