import { element, button } from './dom.js';
import { animateEnter, animateExit, cancelMotion } from './motion.js';

const closing = new WeakMap();
export function closeDialog(dialog) {
  if (closing.has(dialog)) return closing.get(dialog);
  if (!dialog.open) return Promise.resolve();
  dialog.classList.add('is-closing');
  dialog.inert = true;
  const task = animateExit(dialog, { kind: 'dialog' }).then(() => {
    if (dialog.open) dialog.close();
  });
  closing.set(dialog, task);
  return task;
}

/** Native dialogs provide focus containment, Escape, and keyboard activation. */
export function openDialog(title, content, actions = []) {
  const previousFocus = document.activeElement;
  const headingId = `dialog-${crypto.randomUUID()}`;
  const dialog = element('dialog', { className: 'app-dialog', 'aria-labelledby': headingId });
  const close = () => closeDialog(dialog);
  dialog.append(
    element(
      'header',
      {},
      element('h2', { id: headingId }, title),
      button('×', close, {
        className: 'icon-button',
        'aria-label': `Close ${title.toLowerCase()}`,
      }),
    ),
    element('div', { className: 'dialog-content' }, content),
    element(
      'footer',
      {},
      actions.map(({ label, action, primary, ...attributes }) =>
        button(label, () => action(close), { className: primary ? 'primary' : '', ...attributes }),
      ),
    ),
  );
  dialog.addEventListener(
    'close',
    () => {
      cancelMotion(dialog);
      dialog.remove();
      const fallback =
        [...document.querySelectorAll('dialog[open]:not(.is-closing)')]
          .at(-1)
          ?.querySelector('button:not(:disabled)') ??
        document.querySelector('[role="tab"][aria-selected="true"]');
      (previousFocus?.isConnected ? previousFocus : fallback)?.focus?.({ preventScroll: true });
    },
    { once: true },
  );
  document.querySelector('#dialogs').append(dialog);
  dialog.showModal();
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    void closeDialog(dialog);
  });
  void animateEnter(dialog, { kind: 'dialog' });
  return dialog;
}

export function confirmAction(title, text, confirm = 'Confirm') {
  return new Promise((resolve) => {
    let accepted = false;
    const dialog = openDialog(title, element('p', {}, text), [
      { label: 'Cancel', action: (close) => close() },
      {
        label: confirm,
        primary: true,
        action: (close) => {
          accepted = true;
          close();
        },
      },
    ]);
    dialog.addEventListener('close', () => resolve(accepted), { once: true });
  });
}

export function renameDialog(name) {
  return new Promise((resolve) => {
    const input = element('input', { value: name, 'aria-label': 'Session name', maxLength: 200 });
    let result = null;
    const apply = (close) => {
      if (input.value.trim()) {
        result = input.value.trim();
        close();
      }
    };
    const dialog = openDialog('Rename session', input, [
      { label: 'Cancel', action: (close) => close() },
      { label: 'Rename', primary: true, action: apply },
    ]);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') apply(() => closeDialog(dialog));
    });
    dialog.addEventListener('close', () => resolve(result), { once: true });
    input.select();
  });
}
