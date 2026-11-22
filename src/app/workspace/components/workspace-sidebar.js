import { element, button } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';

export function createWorkspaceSidebar(state, openLibrary, navigate) {
  const sidebar = element('aside', { className: 'sidebar' });
  const toolLink = (id, title, iconName) =>
    button(
      [icon(iconName, 20), element('span', { className: 'tool-label' }, title), icon('plus', 13)],
      () => navigate(() => state.create(id)),
      {
        className: 'tool-link',
        'aria-label': `New ${id === 'output-analyzer' ? 'DER/DPR Output Analyzer' : title} session`,
        title: `New ${title} session`,
      },
    );
  const sqlLink = toolLink('sql-formatter', 'SQL Formatter', 'code');
  const analyzerLink = toolLink('output-analyzer', 'Output Analyzer', 'table');
  const markdownLink = toolLink('markdown-editor', 'Markdown Editor', 'markdown');
  const savedCount = element('span', { className: 'saved-count' });
  const collapse = button(
    icon('collapse'),
    () => state.setAppearance({ collapsed: !state.appearance.collapsed }),
    { className: 'icon-button sidebar-collapse', 'aria-label': 'Collapse sidebar' },
  );
  sidebar.append(
    element(
      'div',
      { className: 'brand' },
      element('div', { className: 'brand-mark' }, icon('command', 23)),
      element('strong', { className: 'brand-name' }, 'Work Utilities'),
    ),
    element('div', { className: 'nav-section-label eyebrow' }, 'Tools'),
    element('nav', { 'aria-label': 'Tools' }, sqlLink, analyzerLink, markdownLink),
    element(
      'div',
      { className: 'sidebar-bottom' },
      button(
        [
          icon('library', 18),
          element('span', { className: 'tool-label' }, 'Session library'),
          savedCount,
        ],
        () => navigate(openLibrary),
        { className: 'library-link', 'aria-label': 'Open session library' },
      ),
      collapse,
    ),
  );

  return {
    element: sidebar,
    collapse,
    update() {
      collapse.setAttribute(
        'aria-label',
        state.appearance.collapsed ? 'Expand sidebar' : 'Collapse sidebar',
      );
      collapse.replaceChildren(icon(state.appearance.collapsed ? 'expand' : 'collapse'));
      savedCount.textContent = String(state.summaries.length);
      sqlLink.classList.toggle('active', state.activeSession?.toolId === 'sql-formatter');
      analyzerLink.classList.toggle('active', state.activeSession?.toolId === 'output-analyzer');
      markdownLink.classList.toggle('active', state.activeSession?.toolId === 'markdown-editor');
    },
  };
}
