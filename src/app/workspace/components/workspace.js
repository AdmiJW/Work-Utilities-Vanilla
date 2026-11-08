import { createWorkspaceSidebar } from './workspace-sidebar.js';
import { createWorkspaceBackupActions } from './workspace-backup-actions.js';
import { element, button, clear, subscribeTo } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { backgroundStatus } from '../../shared/background-task.js';
import { createSqlFormatter } from '../../sql-formatter/public-api.js';
import { createOutputAnalyzer } from '../../output-analyzer/public-api.js';
import { createMarkdownTool } from '../../markdown-editor/public-api.js';
import { applyAppearance } from '../../appearance/public-api.js';
import { downloadApplication, openCompatibility } from '../../portable-app/public-api.js';
import { createSessionTabs } from './session-tabs.js';
import { renderWorkspaceHome } from './workspace-home.js';
import { openSessionLibrary } from './session-library.js';
import { openDebugDialog } from './debug-dialog.js';
import { installManualSave } from './manual-save.js';
import { animateEnter, cancelMotion } from '../../shared/motion.js';

export function mountWorkspace(root, state, lock) {
  const views = new Map();
  let generation = state.generation;
  let homeKey = '';
  let library = null;
  const counts = new Map();
  const openLibrary = () => {
    if (!library?.open) library = openSessionLibrary(state);
  };
  const { backup, restore } = createWorkspaceBackupActions(state);
  const sidebar = createWorkspaceSidebar(state, openLibrary);
  const breadcrumb = element('strong');
  const saveStatus = element('span', { className: 'save-status', role: 'status' });
  const manualFeedback = element('div', {
    className: 'manual-save-feedback',
    role: 'status',
    'aria-live': 'polite',
    hidden: true,
  });
  const theme = button(
    icon('moon'),
    () => state.setAppearance({ theme: state.appearance.theme === 'dark' ? 'light' : 'dark' }),
    { className: 'icon-button', 'aria-label': 'Switch to dark theme' },
  );
  const header = element(
    'header',
    { className: 'workspace-header' },
    element(
      'div',
      { className: 'breadcrumb' },
      icon('table'),
      element('span', {}, 'Workspace'),
      breadcrumb,
    ),
    element(
      'div',
      { className: 'header-status' },
      saveStatus,
      element(
        'span',
        { className: 'connectivity', title: 'All application resources are included in this HTML' },
        'Offline ready',
      ),
      button(icon('download'), downloadApplication, {
        className: 'icon-button',
        'aria-label': 'Download offline app',
        title: 'Download offline app',
      }),
      button(icon('settings'), () => openCompatibility(state, lock), {
        className: 'icon-button',
        'aria-label': 'Browser compatibility',
        title: 'Browser compatibility',
      }),
      theme,
      button('Debug', () => openDebugDialog(state)),
    ),
  );
  const notice = element('div', { className: 'notice error', role: 'alert', hidden: true });
  const memoryNotice = element('div', { className: 'notice', role: 'status', hidden: true });
  const tabs = createSessionTabs(state);
  const panel = element('section', { id: 'tool-panel', className: 'tool-panel' });
  const home = element('div', { className: 'workspace-home' });
  const footerInfo = element('span', { className: 'mono' });
  const footer = element(
    'footer',
    { className: 'workspace-footer' },
    button('Export workspace', backup),
    button('Import workspace', restore),
    footerInfo,
    element('span', {}, 'Work Utilities Vanilla'),
    element('span', { className: 'version mono' }, 'v1.0'),
  );
  const main = element(
    'main',
    { className: 'main-workspace' },
    header,
    manualFeedback,
    notice,
    memoryNotice,
    tabs.element,
    panel,
    footer,
  );
  const workspace = element('div', { className: 'workspace' }, sidebar.element, main);
  clear(root, workspace);
  const stopSave = installManualSave(state, manualFeedback);
  let layoutFrame;
  const measure = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => views.get(state.activeId)?.activate());
  };
  const transition = (event) => {
    if (event.target === workspace && event.propertyName === 'grid-template-columns') measure();
  };
  workspace.addEventListener('transitionend', transition);
  workspace.addEventListener('layoutsettled', measure);

  function update() {
    applyAppearance(state.appearance);
    const expanded =
      workspace.classList.contains('sidebar-collapsed') && !state.appearance.collapsed;
    workspace.classList.toggle('sidebar-collapsed', state.appearance.collapsed);
    if (expanded)
      for (const label of sidebar.element.querySelectorAll('.tool-label,.brand-name'))
        void animateEnter(label, { kind: 'view', duration: 120 });
    workspace.inert = state.busy;
    workspace.setAttribute('aria-busy', String(state.busy));
    theme.setAttribute(
      'aria-label',
      state.appearance.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    );
    clear(theme, icon(state.appearance.theme === 'dark' ? 'sun' : 'moon'));
    sidebar.update();
    breadcrumb.textContent = state.activeSession ? `› ${state.activeSession.name}` : '';
    saveStatus.textContent = !state.repository.persistent
      ? 'Memory only'
      : state.autosave.status === 'saved'
        ? 'All changes saved'
        : state.autosave.status === 'saving'
          ? 'Saving…'
          : 'Save failed';
    saveStatus.classList.toggle('failed', state.autosave.status === 'error');
    const error = state.error || state.autosave.error || (state.activeId ? state.openingError : '');
    notice.hidden = !error;
    if (error)
      clear(
        notice,
        element('span', {}, error),
        button('Retry save', () => state.autosave.flush()),
        button('Dismiss', () => {
          state.error = '';
          state.openingError = '';
          state.notify();
        }),
      );
    const warning = [
      state.repository.storageError,
      backgroundStatus.value.message,
      !lock.supported ? 'Use one editing window: browser workspace locking is unavailable.' : '',
    ]
      .filter(Boolean)
      .join(' ');
    memoryNotice.hidden = !warning;
    memoryNotice.textContent = warning;
    tabs.update();
    if (generation !== state.generation) {
      counts.clear();
      for (const view of views.values()) {
        view.dispose();
        cancelMotion(view.element);
        view.element.remove();
      }
      views.clear();
      generation = state.generation;
    }
    for (const [id, view] of views)
      if (!state.openSessions.some((session) => session.id === id)) {
        cancelMotion(view.element);
        view.dispose();
        view.element.remove();
        views.delete(id);
      }
    panel.inert = state.openingId !== null;
    panel.setAttribute('aria-busy', String(state.openingId !== null));
    for (const [id, view] of views) {
      if (id !== state.activeId) {
        cancelMotion(view.element);
        view.element.remove();
      } else {
        if (!view.element.isConnected) {
          panel.append(view.element);
          view.activate();
          void animateEnter(view.element, { kind: 'view' });
        }
        view.update();
      }
    }
    const active = state.activeSession;
    if (active && !views.has(active.id)) {
      const factory = {
        'sql-formatter': createSqlFormatter,
        'output-analyzer': createOutputAnalyzer,
        'markdown-editor': createMarkdownTool,
      }[active.toolId];
      const view = factory(state, active.id);
      views.set(active.id, view);
      panel.append(view.element);
      view.update();
      void animateEnter(view.element, { kind: 'view' });
    }
    if (active) {
      home.remove();
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${active.id}`);
      const document = state.document(active.id);
      if (counts.get(active.id)?.revision !== document.revision) {
        let lines = 1;
        for (
          let p = document.source.indexOf('\n');
          p !== -1;
          p = document.source.indexOf('\n', p + 1)
        )
          lines++;
        counts.set(active.id, { revision: document.revision, lines });
      }
      footerInfo.textContent = `${counts.get(active.id).lines.toLocaleString()} lines · ${document.source.length.toLocaleString()} characters`;
      for (const id of counts.keys()) if (!state.documents.has(id)) counts.delete(id);
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      footerInfo.textContent = '';
      const key = JSON.stringify([state.summaries, state.openingId, state.openingError]);
      if (key !== homeKey || !home.firstChild) {
        homeKey = key;
        clear(home, renderWorkspaceHome(state, openLibrary));
      }
      if (!home.isConnected) {
        panel.append(home);
        void animateEnter(home, { kind: 'view' });
      }
    }
  }
  const unsubscribe = subscribeTo(state, update);
  const stopBackground = subscribeTo(backgroundStatus, update);
  update();
  return {
    update,
    dispose() {
      stopSave();
      cancelAnimationFrame(layoutFrame);
      workspace.removeEventListener('transitionend', transition);
      workspace.removeEventListener('layoutsettled', measure);
      unsubscribe();
      stopBackground();
      for (const view of views.values()) {
        cancelMotion(view.element);
        view.dispose();
      }
    },
  };
}
