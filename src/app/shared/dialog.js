import { element, button } from './dom.js';

/** Native dialogs provide focus containment, Escape, and keyboard activation. */
export function openDialog(title, content, actions = []) {
  const previousFocus = document.activeElement;
  const headingId = `dialog-${crypto.randomUUID()}`;
  const dialog = element('dialog', { className: 'app-dialog', 'aria-labelledby': headingId });
  const close = () => dialog.close();
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
      dialog.remove();
      previousFocus?.focus?.();
    },
    { once: true },
  );
  document.querySelector('#dialogs').append(dialog);
  dialog.showModal();
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
      if (event.key === 'Enter') apply(() => dialog.close());
    });
    dialog.addEventListener('close', () => resolve(result), { once: true });
    input.select();
  });
}
