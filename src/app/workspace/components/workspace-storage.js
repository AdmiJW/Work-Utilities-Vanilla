import { filePickersAvailable } from '../../sessions/public-api.js';
import { element, button } from '../../shared/dom.js';
import { openDialog, confirmAction } from '../../shared/dialog.js';

export function createWorkspaceStorage(state, exportBackup) {
  const p = state.persistence;
  const confirmOpen = () =>
    confirmAction(
      'Open workspace file?',
      'Replace the current workspace with the selected file, including its sessions, tabs, and preferences?',
      'Open workspace',
    );
  const confirmBrowser = () =>
    confirmAction(
      'Replace browser workspace?',
      'Copy the current workspace into Browser storage, replacing its different saved sessions and preferences?',
      'Use Browser storage',
    );
  const overwrite = async () => {
    if (
      await confirmAction(
        'Overwrite workspace file?',
        'Replace the externally changed file with the workspace currently open in this app?',
        'Overwrite file',
      )
    )
      await p.overwrite();
  };
  const reload = () =>
    p.switches.reload(() =>
      confirmAction(
        'Reload workspace file?',
        'Discard unsaved changes in this app and load the workspace currently on disk?',
        'Reload file',
      ),
    );
  const open = () => p.switches.chooseOpen(confirmOpen);
  const showFile = () => {
    const actions = [
      { label: 'Cancel', action: (close) => close() },
      {
        label: p.mode === 'file' ? 'Save As' : 'Create from current workspace',
        action: (close) => {
          close();
          void p.switches.create();
        },
      },
      {
        label: 'Open existing workspace file',
        primary: true,
        action: (close) => {
          close();
          void open();
        },
      },
    ];
    if (p.needsReconnect) actions.splice(1, 1);
    if (p.handle && p.mode === 'browser')
      actions.splice(1, 0, {
        label: 'Use previous workspace file',
        primary: true,
        action: (close) => {
          close();
          void p.switches.reuse(() =>
            confirmAction(
              'Replace workspace file?',
              `Copy the current workspace into ${p.filename}, replacing its different saved content?`,
              'Use previous file',
            ),
          );
        },
      });
    if (p.handle && (p.needsReconnect || p.error))
      actions.push({
        label: 'Reconnect',
        action: (close) => {
          close();
          void p.reconnect();
        },
      });
    openDialog(
      'Workspace file',
      element(
        'div',
        {},
        element(
          'p',
          {},
          p.mode === 'file'
            ? `Current file: ${p.filename}`
            : 'Save all tools, retained sessions, images, tabs, and settings in one workspace JSON file.',
        ),
        element(
          'p',
          {},
          'Autosaves 10 seconds after the last change. If browser data is cleared, select the existing file again when you reopen the app.',
        ),
      ),
      actions,
    );
  };
  const browser = button('Browser', () => void p.switches.browser(confirmBrowser), {
    'aria-pressed': true,
    title: 'Store this workspace in IndexedDB',
  });
  const file = button('File', showFile, {
    'aria-pressed': false,
    title: 'Store this workspace in a selected file',
  });
  const controls = element(
    'div',
    { className: 'storage-control', role: 'group', 'aria-label': 'Workspace storage' },
    browser,
    file,
  );
  const notice = element('div', {
    className: 'notice error storage-notice',
    role: 'alert',
    hidden: true,
  });
  return {
    element: controls,
    notice,
    update() {
      const available = filePickersAvailable();
      browser.setAttribute('aria-pressed', String(p.mode === 'browser'));
      file.setAttribute('aria-pressed', String(p.mode === 'file'));
      file.disabled = !available;
      file.title = available
        ? p.mode === 'file'
          ? `Workspace file: ${p.filename}`
          : 'Store this workspace in a selected file'
        : 'File System Access API is unavailable in this browser. Use Browser storage and workspace import/export.';
      const error = p.mode === 'file' && (p.error || p.needsReconnect);
      notice.hidden = !error;
      if (error)
        notice.replaceChildren(
          element('span', {}, p.error || 'Reconnect the workspace file to continue.'),
          ...(p.needsReconnect ? [] : [button('Retry file save', () => void p.flush())]),
          ...(p.handle ? [button('Reconnect', () => void p.reconnect())] : []),
          ...(available
            ? [
                button(
                  p.needsReconnect ? 'Open workspace file' : 'Save As',
                  () => void (p.needsReconnect ? open() : p.switches.create()),
                ),
              ]
            : []),
          ...(p.conflict
            ? [
                button('Overwrite file', () => void overwrite()),
                button('Reload file', () => void reload()),
              ]
            : []),
          button('Use Browser storage', () => void p.switches.browser(confirmBrowser)),
          ...(!p.needsReconnect ? [button('Export recovery backup', exportBackup)] : []),
        );
    },
  };
}
