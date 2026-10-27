import { element, button } from './dom.js';

let dismissCurrent = null;

export function openContextMenu(event, items, trigger) {
  dismissCurrent?.();
  event.preventDefault();
  const menu = element('div', {
    className: 'context-menu',
    role: 'menu',
    'aria-label': 'Tab actions',
  });
  let closed = false;
  const close = (restore = true) => {
    if (closed) return;
    closed = true;
    menu.remove();
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', dismiss);
    window.removeEventListener('scroll', dismiss, true);
    dismissCurrent = null;
    if (restore && trigger.isConnected) trigger.focus();
  };
  const dismiss = () => close(false);
  const outside = (pointer) => {
    if (!menu.contains(pointer.target)) close(false);
  };
  for (const item of items)
    menu.append(
      button(
        item.label,
        () => {
          close();
          void item.action();
        },
        {
          role: 'menuitem',
          disabled: item.disabled,
          'aria-disabled': !!item.disabled,
          tabIndex: -1,
        },
      ),
    );
  menu.addEventListener('keydown', (key) => {
    const enabled = [...menu.querySelectorAll('button:not(:disabled)')];
    const index = enabled.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key.key)) {
      key.preventDefault();
      enabled[
        key.key === 'Home'
          ? 0
          : key.key === 'End'
            ? enabled.length - 1
            : (index + (key.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
      ]?.focus();
    } else if (key.key === 'Escape' || key.key === 'Tab') {
      key.preventDefault();
      close();
    }
  });
  document.querySelector('#dialogs').append(menu);
  const bounds = trigger.getBoundingClientRect();
  const x = event.type === 'contextmenu' && event.clientX ? event.clientX : bounds.left;
  const y = event.type === 'contextmenu' && event.clientY ? event.clientY : bounds.bottom;
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  menu.querySelector('button:not(:disabled)')?.focus();
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', dismiss);
  window.addEventListener('scroll', dismiss, true);
  dismissCurrent = close;
  return close;
}
