import { EditorView } from '@codemirror/view';
import { element, button } from '../../shared/dom.js';
import { markdownParser } from '../functions/markdown.js';
import { renderInline } from './inline-content.js';

export function createMarkdownOutline(owner, host, close) {
  const list = element('nav', { 'aria-label': 'Document headings', className: 'md-outline-list' });
  const overlay = element(
    'aside',
    { className: 'md-outline', 'aria-label': 'Table of contents', hidden: true },
    element(
      'div',
      { className: 'md-outline-heading' },
      element('strong', {}, 'Contents'),
      button('×', close, { 'aria-label': 'Close table of contents' }),
    ),
    list,
  );
  host.append(overlay);
  let enabled = false,
    doc = null,
    headings = [],
    frame;
  const highlight = () => {
    if (!enabled) return;
    const view = owner.outer;
    const top = view.lineBlockAtHeight(
      Math.max(0, view.scrollDOM.scrollTop - view.documentPadding.top),
    ).from;
    const current = headings.findLast((heading) => heading.from <= top) ?? headings[0];
    for (const item of list.children) {
      if (Number(item.dataset.position) === current?.from)
        item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    }
  };
  const update = () => {
    if (!enabled) return;
    const view = owner.outer;
    if (view.state.doc !== doc) {
      doc = view.state.doc;
      headings = [];
      markdownParser.parse(doc.toString()).iterate({
        enter(ref) {
          if (['HTMLBlock', 'FencedCode', 'CodeBlock'].includes(ref.name)) return false;
          if (!/^(ATXHeading|SetextHeading)[1-6]$/.test(ref.name)) return;
          const raw = doc
            .sliceString(ref.from, ref.to)
            .split('\n')[0]
            .replace(/^#{1,6}\s+/, '')
            .replace(/\s+#+\s*$/, '');
          headings.push({
            from: ref.from,
            level: Number(ref.name.at(-1)),
            text: renderInline(raw).textContent || '(Untitled heading)',
          });
          return false;
        },
      });
      list.replaceChildren(
        ...headings.map((heading) => {
          const item = button(
            heading.text,
            () => {
              owner.activeTable?.leave(false);
              view.dispatch({
                ...(owner.mode === 'reading' ? {} : { selection: { anchor: heading.from } }),
                effects: EditorView.scrollIntoView(heading.from, { y: 'start', yMargin: 20 }),
              });
              if (owner.mode !== 'reading') view.focus();
            },
            { 'data-position': heading.from, title: heading.text },
          );
          item.style.paddingLeft = `${8 + (heading.level - 1) * 12}px`;
          return item;
        }),
      );
      if (!headings.length) list.append(element('p', { className: 'muted' }, 'No headings'));
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(highlight);
  };
  const search = host.querySelector('.md-find-overlay');
  const resize = new ResizeObserver(() => {
    overlay.style.top = `${Math.max(8, (search?.getBoundingClientRect().height ?? 0) + 16)}px`;
  });
  if (search) resize.observe(search);
  return {
    update,
    setEnabled(value) {
      enabled = value;
      overlay.hidden = !value;
      update();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      overlay.remove();
    },
  };
}
