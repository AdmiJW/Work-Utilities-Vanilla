import { element, button } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { sessionRecency } from '../../sessions/public-api.js';
import { tools } from '../../shared/tool-details.js';

export function renderWorkspaceHome(state, openLibrary) {
  const createCards = () =>
    element(
      'div',
      { className: 'workspace-cards', role: 'group', 'aria-label': 'Start a new session' },
      [
        ['sql-formatter', 'Format, edit, and export Transact-SQL scripts.'],
        ['output-analyzer', 'Inspect execution results and export Excel workbooks.'],
        ['markdown-editor', 'Write and preview Markdown in one editor.'],
      ].map(([id, description]) =>
        button(
          [
            element(
              'span',
              { className: 'tool-card-top' },
              element('span', { className: 'session-icon' }, icon(tools[id].icon, 19)),
              icon('plus'),
            ),
            element('strong', {}, tools[id].title),
            element('span', { className: 'muted' }, description),
          ],
          () => state.create(id),
          { className: 'tool-card', 'aria-label': `New ${tools[id].title}` },
        ),
      ),
    );
  const recent = state.recentSessions.slice(0, 8);
  return element(
    'div',
    { className: 'recent-home' },
    element(
      'div',
      { className: 'recent-content' },
      element(
        'header',
        { className: 'recent-header' },
        element('h1', {}, recent.length ? 'Recent sessions' : 'Workspace'),
        button([icon('library'), 'Session Library'], openLibrary, { className: 'library-action' }),
      ),
      state.openingError
        ? element('p', { className: 'notice error', role: 'alert' }, state.openingError)
        : [],
      recent.length
        ? element(
            'ul',
            { className: 'recent-list', 'aria-label': 'Recently viewed sessions' },
            recent.map((session) =>
              element(
                'li',
                {},
                button(
                  [
                    element(
                      'span',
                      { className: 'session-icon' },
                      icon(tools[session.toolId].icon, 18),
                    ),
                    element(
                      'span',
                      { className: 'session-details' },
                      element('strong', { title: session.name }, session.name),
                      element(
                        'small',
                        {},
                        state.openingId === session.id ? 'Opening…' : tools[session.toolId].title,
                      ),
                    ),
                    element(
                      'span',
                      { className: 'session-time' },
                      `${session.lastViewedAt === undefined ? 'Updated' : 'Viewed'} ${new Date(sessionRecency(session)).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
                    ),
                    icon('arrow', 14),
                  ],
                  () => state.activate(session.id),
                  {
                    className: 'recent-session',
                    'aria-label': `Reopen ${session.name}`,
                    disabled: state.openingId !== null,
                    'aria-busy': state.openingId === session.id,
                  },
                ),
              ),
            ),
          )
        : null,
      recent.length ? element('h2', { className: 'new-session-heading' }, 'New session') : null,
      createCards(),
    ),
  );
}
