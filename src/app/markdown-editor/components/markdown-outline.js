import { EditorView } from '@codemirror/view';
import { element, button } from '../../shared/dom.js';
import { markdownParser } from '../functions/markdown.js';
import { renderInline } from './inline-content.js';

const headingMargin = 20;

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
    frame,
    jump;
  const highlight = () => {
    if (!enabled) return;
    const view = owner.outer;
    const scrollTop = view.scrollDOM.scrollTop;
    if (jump) {
      if (jump.top === undefined) jump.top = scrollTop;
      else if (Math.abs(jump.top - scrollTop) > 1) jump = null;
    }
    const top = view.lineBlockAtHeight(
      Math.max(0, scrollTop - view.documentPadding.top + headingMargin + 1),
    ).from;
    const current =
      jump?.heading ?? headings.findLast((heading) => heading.lineStart <= top) ?? headings[0];
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
      jump = null;
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
            lineStart: doc.lineAt(ref.from).from,
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
              jump = { heading };
              view.dispatch({
                ...(owner.mode === 'reading' ? {} : { selection: { anchor: heading.from } }),
                effects: EditorView.scrollIntoView(heading.from, {
                  y: 'start',
                  yMargin: headingMargin,
                }),
              });
              if (owner.mode !== 'reading') view.focus();
              update();
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
      if (!value) jump = null;
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
