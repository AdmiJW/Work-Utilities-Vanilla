import { createWorkspaceSidebar } from './workspace-sidebar.js';
import { createWorkspaceBackupActions } from './workspace-backup-actions.js';
import { element, button, clear, subscribeTo } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { backgroundStatus } from '../../shared/background-task.js';
import { createSqlFormatter } from '../../sql-formatter/public-api.js';
import { createOutputAnalyzer } from '../../output-analyzer/public-api.js';
import { applyAppearance } from '../../appearance/public-api.js';
import { downloadApplication, openCompatibility } from '../../portable-app/public-api.js';
import { createSessionTabs } from './session-tabs.js';
import { renderWorkspaceHome } from './workspace-home.js';
import { openSessionLibrary } from './session-library.js';

export function mountWorkspace(root, state, lock) {
  const views = new Map();
  let generation = state.generation;
  let homeKey = '';
  let library = null;
  const openLibrary = () => {
    if (!library?.open) library = openSessionLibrary(state);
  };
  const { backup, restore } = createWorkspaceBackupActions(state);
  const sidebar = createWorkspaceSidebar(state, openLibrary);
  const breadcrumb = element('strong');
  const saveStatus = element('span', { className: 'save-status', role: 'status' });
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
    notice,
    memoryNotice,
    tabs.element,
    panel,
    footer,
  );
  const workspace = element('div', { className: 'workspace' }, sidebar.element, main);
  clear(root, workspace);

  function update() {
    applyAppearance(state.appearance);
    workspace.classList.toggle('sidebar-collapsed', state.appearance.collapsed);
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
      for (const view of views.values()) {
        view.dispose();
        view.element.remove();
      }
      views.clear();
      generation = state.generation;
    }
    for (const [id, view] of views)
      if (!state.openSessions.some((session) => session.id === id)) {
        view.dispose();
        view.element.remove();
        views.delete(id);
      }
    panel.inert = state.openingId !== null;
    panel.setAttribute('aria-busy', String(state.openingId !== null));
    for (const [id, view] of views) {
      if (id !== state.activeId) view.element.remove();
      else {
        if (!view.element.isConnected) {
          panel.append(view.element);
          view.activate();
        }
        view.update();
      }
    }
    const active = state.activeSession;
    if (active && !views.has(active.id)) {
      const view =
        active.toolId === 'sql-formatter'
          ? createSqlFormatter(state, active.id)
          : createOutputAnalyzer(state, active.id);
      views.set(active.id, view);
      panel.append(view.element);
      view.update();
    }
    if (active) {
      home.remove();
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `tab-${active.id}`);
      const document = state.document(active.id);
      footerInfo.textContent = `${document.source.split('\n').length.toLocaleString()} lines · ${document.source.length.toLocaleString()} characters`;
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      footerInfo.textContent = '';
      const key = JSON.stringify([state.summaries, state.openingId, state.openingError]);
      if (key !== homeKey || !home.firstChild) {
        homeKey = key;
        clear(home, renderWorkspaceHome(state, openLibrary));
      }
      if (!home.isConnected) panel.append(home);
    }
  }
  const unsubscribe = subscribeTo(state, update);
  const stopBackground = subscribeTo(backgroundStatus, update);
  update();
  return {
    update,
    dispose() {
      unsubscribe();
      stopBackground();
      for (const view of views.values()) view.dispose();
    },
  };
}
