import { element, button, clear } from '../../shared/dom.js';
import { openDialog, closeDialog } from '../../shared/dialog.js';
import { debugCases, debugScreenshots } from '../functions/debug-cases.js';
import { tools } from '../../shared/tool-details.js';

export function openDebugDialog(state) {
  const cases = debugCases();
  let selected = 'sql-formatter';
  let opening = false;
  const list = element('div', { className: 'debug-cases' });
  const error = element('p', { role: 'alert', className: 'notice error', hidden: true });
  const groups = element('nav', { className: 'debug-groups', 'aria-label': 'Debug tools' });
  const toolIds = Object.keys(tools);
  const groupButtons = toolIds.map((toolId) =>
    button(
      tools[toolId].title,
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
      if (!dialog.open || dialog.inert) return;
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
      if (id) void closeDialog(dialog);
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
      button.setAttribute('aria-pressed', String(selected === toolIds[index])),
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
