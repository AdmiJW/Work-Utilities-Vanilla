import { openContextMenu } from './context-menu.js';
import { button, element } from './dom.js';
import { icon } from './icons.js';

export const compactWorkspace = '(width < 1024px)';

export function actionMenu(label, items, { iconName, ...attributes } = {}) {
  let close;
  const toggle = (event) => {
    if (trigger.getAttribute('aria-expanded') === 'true') close();
    else close = openContextMenu(event, items(), trigger, attributes['aria-label'] ?? label);
  };
  const trigger = button(iconName ? icon(iconName, 18) : [label, icon('down', 14)], toggle, {
    ...(iconName ? { 'aria-label': label, title: label } : {}),
    ...attributes,
    'aria-haspopup': 'menu',
    'aria-expanded': false,
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && trigger.getAttribute('aria-expanded') === 'false')
      toggle(event);
  });
  return trigger;
}

export function overflowActions(label, ...controls) {
  for (const control of controls) control.classList.add('desktop-action');
  return actionMenu(
    label,
    () =>
      controls
        .filter((control) => !control.hidden)
        .map((control) => ({
          label: control.getAttribute('aria-label') ?? control.textContent,
          disabled: control.disabled,
          checked: control.hasAttribute('aria-pressed')
            ? control.getAttribute('aria-pressed') === 'true'
            : undefined,
          action: () => control.click(),
        })),
    { className: 'tablet-action' },
  );
}

export function toolToolbar(iconName, filename, ...actions) {
  return element(
    'div',
    { className: 'tool-toolbar' },
    element('div', { className: 'tool-heading' }, icon(iconName, 19), filename),
    element('div', { className: 'toolbar-actions' }, actions),
  );
}

export function segmentedControl(label, className = '') {
  return element('div', {
    className: `segmented-control ${className}`.trim(),
    role: 'group',
    'aria-label': label,
  });
}
