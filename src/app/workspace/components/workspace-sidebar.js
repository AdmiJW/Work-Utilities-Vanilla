import { element, button } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

export function createWorkspaceSidebar(state, openLibrary) {
  const sidebar = element('aside', { className: 'sidebar' });
  const toolLink = (id, title, description, iconName) =>
    button(
      [
        icon(iconName, 20),
        element(
          'span',
          { className: 'tool-label' },
          element('strong', {}, title),
          element('small', {}, description),
        ),
        icon('plus', 13),
      ],
      () => state.create(id),
      {
        className: 'tool-link',
        'aria-label': `New ${id === 'output-analyzer' ? 'DER/DPR Output Analyzer' : title} session`,
        title: `New ${title} session`,
      },
    );
  const sqlLink = toolLink('sql-formatter', 'SQL Formatter', 'Write, format & export', 'code');
  const analyzerLink = toolLink(
    'output-analyzer',
    'Output Analyzer',
    'From logs to clarity',
    'table',
  );
  const savedCount = element('span', { className: 'saved-count' });
  const collapse = button(
    icon('collapse'),
    () => state.setAppearance({ collapsed: !state.appearance.collapsed }),
    { className: 'icon-button', 'aria-label': 'Collapse sidebar' },
  );
  sidebar.append(
    element(
      'div',
      { className: 'brand' },
      element('div', { className: 'brand-mark' }, icon('command', 23)),
      element(
        'strong',
        { className: 'brand-name' },
        'Work',
        element('span', {}, 'Utilities'),
        element('small', {}, 'Vanilla'),
      ),
    ),
    element('div', { className: 'nav-section-label eyebrow' }, 'Tools'),
    element('nav', { 'aria-label': 'Tools' }, sqlLink, analyzerLink),
    element(
      'div',
      { className: 'sidebar-bottom' },
      button(
        [
          icon('library', 18),
          element('span', { className: 'tool-label' }, 'Session library'),
          savedCount,
        ],
        openLibrary,
        { className: 'library-link', 'aria-label': 'Open session library' },
      ),
      collapse,
    ),
  );

  return {
    element: sidebar,
    update() {
      collapse.setAttribute(
        'aria-label',
        state.appearance.collapsed ? 'Expand sidebar' : 'Collapse sidebar',
      );
      savedCount.textContent = String(state.summaries.length);
      sqlLink.classList.toggle('active', state.activeSession?.toolId === 'sql-formatter');
      analyzerLink.classList.toggle('active', state.activeSession?.toolId === 'output-analyzer');
    },
  };
}
