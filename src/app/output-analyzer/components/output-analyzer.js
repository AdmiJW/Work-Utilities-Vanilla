import { element, button, clear, message } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { BackgroundTask } from '../../shared/background-task.js';
import { downloadFile, sanitizeFileName } from '../../file-transfer/public-api.js';
import { analyzeOutput } from '../functions/analyze-output.js';
import { exportWorkbook } from '../functions/export-workbook.js';
import { createCellInspector } from './cell-inspector.js';
import { createInspectorLayout } from './inspector-layout.js';
import { createSourceInput } from './source-input.js';
import { createResultSheets } from './result-sheets.js';

export function createOutputAnalyzer(state, id) {
  let result = null;
  let resultRevision = -1;
  let running = false;
  let exporting = false;
  let selectedCell = null;
  let inspector = null;
  let hasAnalyzed = !!state.document(id).options.analyzed;
  let dark = state.appearance.theme === 'dark';
  let alive = true;
  const analysis = new BackgroundTask('analyze', analyzeOutput);
  const exporter = new BackgroundTask('export', exportWorkbook);
  const doc = () => state.document(id);
  const remember = (options) => state.updateOptions(id, options);
  const heading = element('h1');
  const notice = element('div', { className: 'notice error', role: 'alert', hidden: true });
  const showError = (error) => {
    notice.textContent = message(error);
    notice.hidden = false;
  };
  const sourceView = createSourceInput(state, id, showError, () => {
    notice.hidden = true;
  });
  const progressBar = element('div');
  const progress = element(
    'div',
    {
      className: 'analysis-progress',
      role: 'progressbar',
      'aria-label': 'Analysis progress',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      hidden: true,
    },
    progressBar,
  );
  const sheetsView = createResultSheets(state, id, {
    selected: selectCell,
    inspect: openInspector,
    changed: () => {
      selectedCell = null;
      closeInspector();
    },
  });
  const stage = element('div', { className: 'results-stage' });
  const layout = createInspectorLayout(stage, sheetsView.element, doc().options, remember);
  const toggleInspector = button('‹', () => (inspector ? closeInspector() : openInspector()), {
    className: 'inspector-toggle',
    'aria-label': 'Open cell inspector',
    title: 'Open cell inspector',
  });
  stage.append(toggleInspector);

  function closeInspector() {
    inspector?.dispose();
    inspector = null;
    layout.show(null);
    toggleInspector.hidden = false;
    toggleInspector.setAttribute('aria-label', 'Open cell inspector');
  }
  function openInspector() {
    if (!selectedCell) {
      showError(new Error('Select a data cell, then open its inspector.'));
      return;
    }
    if (!inspector)
      inspector = createCellInspector(
        doc().options.jsonDecodeMode ?? 'shallow',
        (mode) => remember({ jsonDecodeMode: mode }),
        closeInspector,
      );
    inspector.setCell(selectedCell);
    layout.show(inspector.element);
    toggleInspector.hidden = true;
  }
  function selectCell(value) {
    selectedCell = value;
    inspector?.setCell(value);
  }

  async function runAnalysis(restoring = false) {
    if (!doc().source || running) return;
    running = true;
    notice.hidden = true;
    progress.hidden = false;
    const revision = doc().revision;
    update();
    try {
      const parsed = await analysis.run({ source: doc().source }, (value) => {
        progressBar.style.width = `${value}%`;
        progress.setAttribute('aria-valuenow', String(value));
      });
      if (!alive || doc().revision !== revision) return;
      result = parsed;
      resultRevision = revision;
      const options = { analyzed: true };
      if (!hasAnalyzed && !restoring) options.inputCollapsed = true;
      hasAnalyzed = true;
      remember(options);
      sheetsView.setResult(result, resultRevision);
    } catch (error) {
      if (error.name !== 'AbortError') showError(error);
    } finally {
      running = false;
      progress.hidden = true;
      if (alive) update();
    }
  }

  async function exportExcel() {
    if (!result || doc().revision !== resultRevision || exporting) return;
    exporting = true;
    notice.hidden = true;
    update();
    try {
      const output = await exporter.run({ result });
      if (!alive) return;
      if (output.issues.length) {
        clear(
          notice,
          element('strong', {}, 'Excel export blocked'),
          element(
            'ul',
            {},
            output.issues
              .slice(0, 20)
              .map((issue) =>
                element(
                  'li',
                  {},
                  `${issue.sheet}, row ${issue.row}, column ${issue.column}: ${issue.message}`,
                ),
              ),
          ),
        );
        notice.hidden = false;
      } else
        downloadFile(
          output.buffer,
          sanitizeFileName(state.summaries.find((item) => item.id === id).name, '.xlsx'),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
    } catch (error) {
      if (error.name !== 'AbortError') showError(error);
    } finally {
      exporting = false;
      if (alive) update();
    }
  }

  const analyzeButton = button('Analyze output', () => runAnalysis(), { className: 'primary' });
  const exportButton = button('Export Excel', exportExcel);
  const view = element(
    'section',
    { className: 'analyzer tool-view', 'aria-label': 'DER/DPR Output Analyzer' },
    element(
      'div',
      { className: 'tool-toolbar' },
      element(
        'div',
        { className: 'tool-heading' },
        element('span', { className: 'tool-emblem' }, icon('table', 18)),
        heading,
      ),
      element('div', { className: 'toolbar-actions' }, analyzeButton, exportButton),
    ),
    sourceView.element,
    progress,
    notice,
    sheetsView.tabs,
    stage,
  );
  function update() {
    if (!alive || !doc()) return;
    heading.textContent = state.summaries.find((item) => item.id === id)?.name ?? '';
    sourceView.update();
    analyzeButton.disabled = running || !doc().source;
    analyzeButton.textContent = running ? 'Analyzing…' : 'Analyze output';
    exportButton.disabled = exporting || !result || resultRevision !== doc().revision;
    exportButton.textContent = exporting ? 'Exporting…' : 'Export Excel';
    view.classList.toggle('stale-results', !!result && resultRevision !== doc().revision);
    if (dark !== (state.appearance.theme === 'dark')) {
      dark = !dark;
      sheetsView.setTheme(dark);
    }
    inspector?.setMode(doc().options.jsonDecodeMode);
  }
  update();
  if (doc().options.analyzed && doc().source) queueMicrotask(() => void runAnalysis(true));
  return {
    element: view,
    update,
    activate() {},
    dispose() {
      alive = false;
      sourceView.dispose();
      analysis.cancel();
      exporter.cancel();
      sheetsView.dispose();
      inspector?.dispose();
      layout.dispose();
    },
  };
}
