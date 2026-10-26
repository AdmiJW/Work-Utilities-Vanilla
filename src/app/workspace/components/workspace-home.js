import { element, button } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { sessionRecency } from '../../sessions/public-api.js';

export function renderWorkspaceHome(state, openLibrary) {
  const createButtons = () =>
    element(
      'div',
      { className: 'new-actions', role: 'group', 'aria-label': 'Start a new session' },
      button([icon('code'), 'New SQL Formatter', icon('plus', 13)], () =>
        state.create('sql-formatter'),
      ),
      button([icon('table'), 'New Output Analyzer', icon('plus', 13)], () =>
        state.create('output-analyzer'),
      ),
    );
  if (!state.summaries.length)
    return element(
      'div',
      { className: 'welcome-home' },
      element('span', { className: 'eyebrow' }, 'A workspace for the everyday work'),
      element('h1', {}, 'A little less repetitive.'),
      element(
        'p',
        {},
        'Prepare SQL scripts and make sense of execution output. Everything is processed here, on your computer.',
      ),
      createButtons(),
      element(
        'div',
        { className: 'welcome-cards' },
        element(
          'article',
          {},
          icon('code', 25),
          element('h2', {}, 'Write, format & export'),
          element(
            'p',
            {},
            'Edit Transact-SQL comfortably. Prettify it, put each statement on one line, and export the exact text.',
          ),
        ),
        element(
          'article',
          {},
          icon('table', 25),
          element('h2', {}, 'From logs to clarity'),
          element(
            'p',
            {},
            'Explore result sheets, inspect JSON, and export text-preserving Excel workbooks.',
          ),
        ),
      ),
      element('small', {}, 'Portable HTML · No account · No database connection'),
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
        element(
          'div',
          {},
          element('span', { className: 'eyebrow' }, 'Your workspace'),
          element('h1', {}, 'Recent sessions'),
          element('p', {}, 'Pick up where you left off.'),
        ),
        button([icon('library'), 'Session Library'], openLibrary, { className: 'library-action' }),
      ),
      createButtons(),
      state.openingError
        ? element('p', { className: 'notice error', role: 'alert' }, state.openingError)
        : [],
      element(
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
                  icon(session.toolId === 'sql-formatter' ? 'code' : 'table', 18),
                ),
                element(
                  'span',
                  { className: 'session-details' },
                  element('strong', { title: session.name }, session.name),
                  element(
                    'small',
                    {},
                    state.openingId === session.id
                      ? 'Opening…'
                      : session.toolId === 'sql-formatter'
                        ? 'SQL Formatter'
                        : 'Output Analyzer',
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
      ),
    ),
  );
}
