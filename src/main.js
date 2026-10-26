import { SessionRepository, SessionState, WorkspaceLock } from './app/sessions/public-api.js';
import { mountWorkspace } from './app/workspace/public-api.js';
import { element, button } from './app/shared/dom.js';

const root = document.querySelector('#app-root');
root.replaceChildren();
document.querySelector('#dialogs').replaceChildren();
globalThis.__WORK_UTILITIES_WORKERS__ = JSON.parse(
  document.querySelector('#worker-data').textContent,
);
const lock = new WorkspaceLock();
const repository = new SessionRepository();
const state = new SessionState(repository);
let started = false;

async function start() {
  try {
    if (!(await lock.claim())) {
      root.replaceChildren(
        element(
          'div',
          { className: 'window-message' },
          element('h1', {}, 'Your workspace is open in another window'),
          element(
            'p',
            {},
            'Close that window, then retry here to keep your saved sessions consistent.',
          ),
          button('Retry', start),
        ),
      );
      return;
    }
    if (started) return;
    started = true;
    await state.initialize();
    mountWorkspace(root, state, lock);
  } catch (error) {
    started = false;
    root.replaceChildren(
      element(
        'div',
        { className: 'window-message', role: 'alert' },
        element('h1', {}, 'The workspace could not open'),
        element('p', {}, error.message),
        button('Retry', start),
      ),
    );
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void state.autosave.flush();
});
window.addEventListener('pagehide', () => {
  void state.autosave.flush();
  lock.release?.();
});
window.addEventListener('error', (event) =>
  state.fail(
    new Error(
      event.message ||
        'An application error occurred. Export a workspace backup to preserve your work.',
    ),
  ),
);
void start();
