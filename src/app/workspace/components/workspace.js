import { createWorkspaceSidebar } from './workspace-sidebar.js';
import { createWorkspaceBackupActions } from './workspace-backup-actions.js';
import { element, button, clear, subscribeTo } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { backgroundStatus } from '../../shared/background-task.js';
import { createSqlFormatter } from '../../sql-formatter/public-api.js';
import { createOutputAnalyzer } from '../../output-analyzer/public-api.js';
import { createMarkdownTool } from '../../markdown-editor/public-api.js';
import { createDiffChecker } from '../../diff-checker/public-api.js';
import { createJsonFormatter } from '../../json-formatter/public-api.js';
import { applyAppearance } from '../../appearance/public-api.js';
import { downloadApplication, openCompatibility } from '../../portable-app/public-api.js';
import { createSessionTabs } from './session-tabs.js';
import { renderWorkspaceHome } from './workspace-home.js';
import { createSessionFolderControl, openSessionLibrary } from './session-library.js';
import { openDebugDialog } from './debug-dialog.js';
import { installManualSave } from './manual-save.js';
import { animateEnter, cancelMotion } from '../../shared/motion.js';
import { createWorkspaceStorage } from './workspace-storage.js';
import { actionMenu, compactWorkspace } from '../../shared/ui.js';
import { closeDialog, openDialog } from '../../shared/dialog.js';

export function mountWorkspace(root, state, lock) {
  const views = new Map();
  let generation = state.generation;
  let homeKey = '';
  let library = null;
  let drawer = null;
  const compact = matchMedia(compactWorkspace);
  const counts = new Map();
  const openLibrary = () => {
    if (!library?.open) library = openSessionLibrary(state);
  };
  const { backup, restore } = createWorkspaceBackupActions(state);
  const storage = createWorkspaceStorage(state, backup);
  const sessionFolder = createSessionFolderControl(state);
  const sidebar = createWorkspaceSidebar(state, openLibrary, (action) => {
    if (!drawer?.open) return action();
    drawer.addEventListener('close', action, { once: true });
    void closeDialog(drawer);
  });
  const navigation = button(icon('expand', 19), showNavigation, {
    className: 'icon-button tablet-action',
    'aria-label': 'Open workspace navigation',
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
  });
  const breadcrumb = element('strong');
  const storageFilename = element('span', { className: 'storage-filename', hidden: true });
  const saveState = element('span');
  const saveStatus = element(
    'span',
    { className: 'save-status', role: 'status' },
    storageFilename,
    saveState,
  );
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
  const workspaceActions = actionMenu(
    'Workspace',
    () => [
      { label: 'Export workspace', action: backup, disabled: state.persistence.needsReconnect },
      { label: 'Import workspace', action: restore, disabled: state.persistence.needsReconnect },
      { label: 'Download offline app', action: downloadApplication },
      { label: 'Browser compatibility', action: () => openCompatibility(state, lock) },
      { label: 'Debug', action: () => openDebugDialog(state) },
    ],
    { 'aria-label': 'Workspace actions' },
  );
  const header = element(
    'header',
    { className: 'workspace-header' },
    element(
      'div',
      { className: 'header-start' },
      navigation,
      element('div', { className: 'breadcrumb' }, icon('table'), breadcrumb),
    ),
    element(
      'div',
      { className: 'header-status' },
      sessionFolder.element,
      storage.element,
      saveStatus,
      theme,
      workspaceActions,
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
    footerInfo,
    element('span', { className: 'version mono' }, 'v1.0'),
  );
  const main = element(
    'main',
    { className: 'main-workspace' },
    header,
    manualFeedback,
    notice,
    storage.notice,
    memoryNotice,
    tabs.element,
    panel,
    footer,
  );
  const workspace = element('div', { className: 'workspace' }, sidebar.element, main);
  clear(root, workspace);
  function showNavigation() {
    if (drawer?.open || !compact.matches) return;
    drawer = openDialog('Workspace navigation', sidebar.element, [], {
      className: 'navigation-drawer',
      returnFocus: () => (compact.matches ? navigation : sidebar.collapse),
    });
    navigation.setAttribute('aria-expanded', 'true');
    drawer.addEventListener(
      'close',
      () => {
        workspace.prepend(sidebar.element);
        if (!compact.matches) sidebar.collapse.focus();
        navigation.setAttribute('aria-expanded', 'false');
        drawer = null;
      },
      { once: true },
    );
  }
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
  const onCompactChange = () => {
    if (!compact.matches && drawer?.open) void closeDialog(drawer);
    measure();
  };
  compact.addEventListener('change', onCompactChange);

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
    sessionFolder.update();
    storage.update();
    sidebar.element.inert = state.busy || state.persistence.needsReconnect;
    navigation.disabled = state.persistence.needsReconnect;
    tabs.element.inert = state.persistence.needsReconnect;
    footer.inert = state.persistence.needsReconnect;
    breadcrumb.textContent = state.activeSession?.name ?? 'Workspace';
    breadcrumb.title = breadcrumb.textContent;
    let status = !state.repository.persistent
      ? 'Memory only'
      : state.autosave.status === 'saved'
        ? 'All changes saved'
        : state.autosave.status === 'saving'
          ? 'Saving…'
          : 'Save failed';
    const fileMode = state.persistence.mode === 'file';
    storageFilename.hidden = !fileMode;
    if (fileMode) {
      storageFilename.textContent = state.persistence.filename;
      status = {
        saved: 'All changes saved',
        unsaved: 'Unsaved changes',
        saving: 'Saving…',
        error: 'Save failed',
        reconnect: 'Reconnect required',
      }[state.persistence.status];
    }
    if (saveState.textContent !== status) saveState.textContent = status;
    saveStatus.classList.toggle('saved', status === 'All changes saved');
    saveStatus.classList.toggle(
      'failed',
      status === 'Save failed' || status === 'Reconnect required',
    );
    saveStatus.title = fileMode ? `${state.persistence.filename} · ${status}` : status;
    const error =
      state.error ||
      (state.persistence.mode === 'browser' ? state.autosave.error : '') ||
      (state.activeId ? state.openingError : '');
    notice.hidden = !error;
    if (error)
      clear(
        notice,
        element('span', {}, error),
        button('Retry save', () => state.persistence.flush()),
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
    panel.inert = state.openingId !== null || state.persistence.needsReconnect;
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
        'diff-checker': createDiffChecker,
        'json-formatter': createJsonFormatter,
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
        const sources =
          active.toolId === 'diff-checker'
            ? [document.source, document.options.rightText ?? '']
            : [document.source];
        let lines = sources.length,
          characters = 0;
        for (const source of sources) {
          for (let p = source.indexOf('\n'); p !== -1; p = source.indexOf('\n', p + 1)) lines++;
          characters += source.length;
        }
        counts.set(active.id, { revision: document.revision, lines, characters });
      }
      const { lines, characters } = counts.get(active.id);
      footerInfo.textContent = `${lines.toLocaleString()} lines · ${characters.toLocaleString()} characters`;
      for (const id of counts.keys()) if (!state.documents.has(id)) counts.delete(id);
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
      footerInfo.textContent = '';
      const key = JSON.stringify([state.savedSessions, state.openingId, state.openingError]);
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
      compact.removeEventListener('change', onCompactChange);
      if (drawer?.open) void closeDialog(drawer);
      unsubscribe();
      stopBackground();
      for (const view of views.values()) {
        cancelMotion(view.element);
        view.dispose();
      }
    },
  };
}
