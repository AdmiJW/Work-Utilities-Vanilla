import { element, button } from '../../shared/dom.js';
import { icon } from '../../shared/icons.js';
import { tools } from '../../shared/tool-details.js';

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
  const links = Object.entries(tools).map(([id, { title, icon }]) => [
    id,
    toolLink(id, title, icon),
  ]);
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
    element(
      'nav',
      { 'aria-label': 'Tools' },
      links.map(([, link]) => link),
    ),
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
      savedCount.textContent = String(state.savedSessions.length);
      for (const [id, link] of links)
        link.classList.toggle('active', state.activeSession?.toolId === id);
    },
  };
}
