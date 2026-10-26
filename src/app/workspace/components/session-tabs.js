import { element, button, clear } from '../../shared/dom.js';
import { renameDialog, openDialog } from '../../shared/dialog.js';
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
  const rename = async (session) => {
    const name = await renameDialog(session.name);
    if (name) state.rename(session.id, name);
  };
  const context = (session) => {
    const choose = (action) => () => {
      dialog.close();
      void action();
    };
    const dialog = openDialog(
      'Tab actions',
      element(
        'div',
        { className: 'tab-menu', role: 'menu', 'aria-label': `Actions for ${session.name}` },
        button(
          'Close',
          choose(() => state.close(session.id)),
          { role: 'menuitem' },
        ),
        button(
          'Close to the Right',
          choose(() => state.closeMany(state.order.slice(state.order.indexOf(session.id) + 1))),
          {
            role: 'menuitem',
            disabled: state.order.at(-1) === session.id,
            'aria-disabled': state.order.at(-1) === session.id,
          },
        ),
        button(
          'Close All',
          choose(() => state.closeMany([...state.order])),
          { role: 'menuitem' },
        ),
        button(
          'Rename',
          choose(() => rename(session)),
          { role: 'menuitem' },
        ),
      ),
    );
  };
  function update() {
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
    clear(
      host,
      state.openSessions.map((session) => {
        const tab = button(
          [icon(session.toolId === 'sql-formatter' ? 'code' : 'table', 13), session.name],
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
        tab.addEventListener('dblclick', () => void rename(session));
        const shell = element(
          'div',
          {
            className: `tab-shell${state.activeId === session.id ? ' active' : ''}`,
            dataset: { sessionId: session.id },
          },
          tab,
          button('×', () => state.close(session.id), {
            className: 'tab-close',
            'aria-label': `Close ${session.name}`,
          }),
        );
        attachTabDrag(host, shell, session.id, state, (order) => {
          suppressUntil = Date.now() + 300;
          state.reorder(order);
        });
        const openMenu = (event) => {
          event.preventDefault();
          context(session);
        };
        shell.addEventListener('contextmenu', openMenu);
        tab.addEventListener('keydown', (event) => {
          if (event.key === 'F2') {
            event.preventDefault();
            void rename(session);
          }
          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')
            openMenu(event);
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
        return shell;
      }),
    );
    if (focused) host.querySelector(`[id="tab-${focused}"]`)?.focus();
    host
      .querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  return { element: host, update };
}
