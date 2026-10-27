import { element, button } from '../../shared/dom.js';
import { startInlineRename } from '../../shared/inline-rename.js';
import { openContextMenu } from '../../shared/context-menu.js';
import { icon } from '../../shared/icons.js';
import { attachTabDrag } from './tab-drag.js';

export function createSessionTabs(state) {
  const host = element('div', {
    className: 'session-tabs',
    role: 'tablist',
    'aria-label': 'Tool sessions',
  });
  let signature = '';
  let suppressUntil = 0;
  let renaming = false;
  const nodes = new Map();
  const rename = (session, tab) => {
    if (renaming) return;
    renaming = true;
    startInlineRename(tab, session.name, (name) => state.rename(session.id, name), {
      finished: () => {
        renaming = false;
        queueMicrotask(update);
      },
    });
  };
  const context = (event, session, tab) =>
    openContextMenu(
      event,
      [
        { label: 'Close', action: () => state.close(session.id) },
        {
          label: 'Close to the Right',
          disabled: state.order.at(-1) === session.id,
          action: () => state.closeMany(state.order.slice(state.order.indexOf(session.id) + 1)),
        },
        { label: 'Close All', action: () => state.closeMany([...state.order]) },
        { label: 'Rename', action: () => rename(session, tab) },
      ],
      tab,
    );
  function update() {
    if (renaming) return;
    host.hidden = state.openSessions.length === 0;
    const key = JSON.stringify([
      state.activeId,
      state.openSessions.map(({ id, name }) => [id, name]),
    ]);
    if (key === signature) return;
    signature = key;
    const focused = host.contains(document.activeElement)
      ? document.activeElement.closest('[data-session-id]')?.dataset.sessionId
      : null;
    const shells = state.openSessions.map((session) => {
      const existing = nodes.get(session.id);
      if (existing) {
        existing.label.textContent = session.name;
        existing.tab.setAttribute('aria-selected', String(state.activeId === session.id));
        existing.tab.tabIndex = state.activeId === session.id ? 0 : -1;
        existing.shell.classList.toggle('active', state.activeId === session.id);
        existing.close.setAttribute('aria-label', `Close ${session.name}`);
        return existing.shell;
      }
      const current = () => state.summaries.find((item) => item.id === session.id);
      const label = element('span', {}, session.name);
      const tab = button(
        [icon(session.toolId === 'sql-formatter' ? 'code' : 'table', 13), label],
        () => {
          if (Date.now() >= suppressUntil) void state.activate(session.id);
        },
        {
          role: 'tab',
          id: `tab-${session.id}`,
          'aria-selected': state.activeId === session.id,
          'aria-controls': 'tool-panel',
          tabIndex: state.activeId === session.id ? 0 : -1,
          dataset: { sessionId: session.id },
        },
      );
      tab.addEventListener('dblclick', () => rename(current(), tab));
      const close = button('×', () => state.close(session.id), {
        className: 'tab-close',
        'aria-label': `Close ${session.name}`,
      });
      const shell = element(
        'div',
        {
          className: `tab-shell${state.activeId === session.id ? ' active' : ''}`,
          dataset: { sessionId: session.id },
        },
        tab,
        close,
      );
      attachTabDrag(host, shell, session.id, state, (order) => {
        suppressUntil = Date.now() + 300;
        state.reorder(order);
      });
      const openMenu = (event) => {
        event.preventDefault();
        context(event, current(), tab);
      };
      shell.addEventListener('contextmenu', openMenu);
      tab.addEventListener('keydown', (event) => {
        if (event.key === 'F2') {
          event.preventDefault();
          rename(current(), tab);
        }
        if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') openMenu(event);
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const index = state.order.indexOf(session.id);
          const target =
            event.key === 'Home'
              ? state.order[0]
              : event.key === 'End'
                ? state.order.at(-1)
                : state.order[
                    (index + (event.key === 'ArrowRight' ? 1 : -1) + state.order.length) %
                      state.order.length
                  ];
          void state.activate(target);
          host.querySelector(`[id="tab-${target}"]`)?.focus();
        }
      });
      nodes.set(session.id, { shell, tab, label, close });
      return shell;
    });
    for (const [id, node] of nodes)
      if (!state.order.includes(id)) {
        node.shell.remove();
        nodes.delete(id);
      }
    shells.forEach((shell, index) => {
      if (host.children[index] !== shell) host.insertBefore(shell, host.children[index] ?? null);
    });
    if (focused) host.querySelector(`[id="tab-${focused}"]`)?.focus();
    host
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return { element: host, update };
}
