import { element, button } from '../shared/dom.js';
import { openDialog } from '../shared/dialog.js';
import { downloadFile } from '../file-transfer/public-api.js';
import { backgroundStatus } from '../shared/background-task.js';

export function openCompatibility(state, lock) {
  const details = element('dl', { className: 'compatibility-list' });
  const add = (label, value) => details.append(element('dt', {}, label), element('dd', {}, value));
  add('Application', 'Work Utilities Vanilla · version 1.0.0');
  add(
    'Location',
    location.protocol === 'file:'
      ? 'Local HTML file. No server is needed.'
      : 'Hosted self-contained HTML. Save a copy for local use.',
  );
  add(
    'Autosave',
    state.repository.persistent
      ? 'Browser storage is available. Export backups before moving or updating the application.'
      : 'Memory only. Export a workspace backup before closing.',
  );
  add(
    'Background processing',
    backgroundStatus.value.mode === 'workers'
      ? 'Embedded workers are available; failures fall back to foreground processing.'
      : backgroundStatus.value.message,
  );
  add(
    'Editing window',
    lock.supported
      ? 'One editing window is allowed for this browser workspace.'
      : 'Browser locking is unavailable. Use one editing window to avoid competing saves.',
  );
  add(
    'Updates',
    'Download the new HTML, export a workspace backup, replace your local app file, then import the backup if your saved sessions are not present.',
  );
  const copyHelp = element(
    'p',
    { className: 'hint' },
    'If clipboard access is blocked, Copy opens selectable text for Ctrl+C. If downloads are blocked, the browser may show its own message.',
  );
  const test = element('p', { role: 'status', className: 'hint' });
  return openDialog(
    'Browser compatibility',
    element(
      'div',
      {},
      details,
      copyHelp,
      button('Test a download', () => {
        downloadFile(
          'Work Utilities local download test. No session data is included.',
          'work-utilities-test.txt',
        );
        test.textContent = 'Download requested. Check your browser’s downloads list.';
      }),
      test,
      element(
        'details',
        {},
        element('summary', {}, 'Third-party licenses'),
        element(
          'pre',
          { className: 'license-text' },
          JSON.parse(document.querySelector('#third-party-licenses').textContent),
        ),
      ),
    ),
    [{ label: 'Done', action: (close) => close() }],
  );
}
