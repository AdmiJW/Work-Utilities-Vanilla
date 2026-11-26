import { Decoration } from '@codemirror/view';
import { BackgroundTask } from '../../shared/background-task.js';
import { button, element, message } from '../../shared/dom.js';
import { createNumberedEditor } from '../../shared/numbered-editor.js';
import { toolToolbar } from '../../shared/ui.js';
import { compareText } from '../functions/compare-text.js';
import {
  diffDecorations,
  diffLineHeight,
  diffRanges,
  setDiffDecorations,
} from '../adapters/diff-decorations.js';

export function createDiffChecker(state, id) {
  const document = state.document(id);
  const task = new BackgroundTask('diff', compareText);
  const status = element('span', { className: 'diff-status', role: 'status' });
  const compare = button('Compare', compareEditors, { variant: 'primary' });
  const panes = element('div', { className: 'diff-panes' });
  panes.style.setProperty('--editor-line-height', `${diffLineHeight}px`);
  let request = 0,
    showing = false;
  const editors = ['Left', 'Right'].map((side, index) => {
    const host = element('div', { className: 'numbered-editor' });
    panes.append(element('div', { className: 'diff-pane' }, element('h2', {}, side), host));
    return createNumberedEditor(host, {
      source: index === 0 ? document.source : (document.options.rightText ?? ''),
      label: `${side} text`,
      dark: state.appearance.theme === 'dark',
      extensions: [diffDecorations],
      changed: () => edited(index),
    });
  });
  const views = editors.map(({ editor }) => editor);
  const texts = () => views.map(({ state }) => state.doc.toString());
  for (const [index, { scrollDOM }] of views.entries())
    scrollDOM.addEventListener('scroll', () => {
      if (!showing) return;
      const other = views[1 - index].scrollDOM;
      if (other.scrollTop !== scrollDOM.scrollTop) other.scrollTop = scrollDOM.scrollTop;
    });

  function edited(index) {
    request++;
    task.cancel();
    if (showing) {
      showing = false;
      views[1 - index].dispatch({ effects: setDiffDecorations.of(Decoration.none) });
    }
    status.textContent = '';
    compare.disabled = false;
    state.updateDiffText(id, ...texts());
  }

  async function compareEditors() {
    const current = ++request;
    const [left, right] = texts();
    compare.disabled = true;
    status.textContent = 'Comparing…';
    try {
      const chunks = await task.run({ left, right });
      if (request !== current) return;
      const decorations = diffRanges(
        chunks,
        views.map(({ state }) => state.doc),
      );
      for (const [index, view] of views.entries())
        view.dispatch({ effects: setDiffDecorations.of(decorations[index]) });
      showing = true;
      views[1].scrollDOM.scrollTop = views[0].scrollDOM.scrollTop;
      const changes = `${chunks.length} changed ${chunks.length === 1 ? 'section' : 'sections'}`;
      status.textContent = !chunks.length
        ? 'Texts are identical.'
        : chunks.some((chunk) => !chunk.precise)
          ? `${changes}. Large differences are grouped.`
          : changes;
    } catch (error) {
      if (request === current) status.textContent = message(error);
    } finally {
      if (request === current) compare.disabled = false;
    }
  }

  return {
    element: element(
      'section',
      { className: 'tool-view diff-checker', 'aria-label': 'Diff Checker' },
      toolToolbar('diff', element('h1', {}, 'Diff Checker'), status, compare),
      panes,
    ),
    update() {
      for (const editor of editors) editor.setTheme(state.appearance.theme === 'dark');
    },
    activate() {
      for (const view of views) view.requestMeasure();
    },
    dispose() {
      request++;
      task.cancel();
      for (const view of views) view.destroy();
    },
  };
}
