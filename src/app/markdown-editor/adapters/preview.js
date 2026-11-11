import { StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { element } from '../../shared/dom.js';
import { linkParts, referenceKey, readTable, safeLink } from '../functions/markdown.js';
import { TableWidget } from '../components/table-widget.js';
import { ImageWidget } from '../components/image-widget.js';
import { renderInline, markdownText } from '../components/inline-content.js';
import { htmlRoots } from '../functions/html-roots.js';
import { HTMLWidget } from '../components/html-widget.js';
import { inlineSpanActive } from '../functions/inline-format.js';

class CheckboxWidget extends WidgetType {
  constructor(owner, from, checked, reading) {
    super();
    Object.assign(this, { owner, from, checked, reading });
  }
  eq(other) {
    return (
      this.from === other.from && this.checked === other.checked && this.reading === other.reading
    );
  }
  toDOM() {
    const input = element('input', {
      type: 'checkbox',
      checked: this.checked,
      disabled: this.reading,
      'aria-label': this.checked ? 'Mark task incomplete' : 'Mark task complete',
      className: 'md-task',
    });
    input.addEventListener('change', () =>
      this.owner.patch({
        from: this.from,
        to: this.from + 3,
        insert: input.checked ? '[x]' : '[ ]',
      }),
    );
    return input;
  }
  ignoreEvent() {
    return true;
  }
}

class TextWidget extends WidgetType {
  constructor(text, inline = false) {
    super();
    this.text = text;
    this.inline = inline;
  }
  eq(other) {
    return this.text === other.text && this.inline === other.inline;
  }
  toDOM() {
    const span = element('span');
    span.append(this.inline ? renderInline(this.text) : this.text);
    return span;
  }
}

function cacheDocument(state, owner) {
  const tree = syntaxTree(state);
  if (owner.previewCache?.doc === state.doc && owner.previewCache.tree === tree)
    return owner.previewCache;
  const nodes = [],
    blocks = [],
    references = new Map(),
    tables = new Map(),
    images = new Map();
  tree.iterate({
    enter: (ref) => {
      const node = ref.node;
      if (node.name === 'LinkReference') {
        const label = node.getChild('LinkLabel'),
          url = node.getChild('URL');
        if (label && url) {
          const key = referenceKey(state.sliceDoc(label.from + 1, label.to - 1));
          if (!references.has(key))
            references.set(key, state.sliceDoc(url.from, url.to).replace(/^<|>$/g, ''));
        }
      }
      if (
        /^(Paragraph|ATXHeading\d|SetextHeading\d|FencedCode|CodeBlock|HTMLBlock|LinkReference)$/.test(
          node.name,
        )
      )
        blocks.push(node);
      nodes.push(node);
      if (node.name === 'Image') return false;
    },
  });
  if (
    references.size !== owner.references.size ||
    [...references].some(([key, value]) => owner.references.get(key) !== value)
  )
    owner.referenceVersion++;
  owner.references = references;
  const imageURLs = new Set();
  for (const node of nodes) {
    if (node.name === 'Table') tables.set(node.from, readTable(node, state.doc));
    if (node.name === 'Image') {
      const parts = linkParts(node, (from, to) => state.sliceDoc(from, to), references);
      images.set(node.from, parts);
      imageURLs.add(parts.url);
    }
  }
  owner.pruneImages?.(imageURLs);
  return (owner.previewCache = { tree, doc: state.doc, nodes, blocks, references, tables, images });
}

export function createPreviewField(owner) {
  function build(state) {
    if (owner.mode === 'source') return { decorations: Decoration.none, atomic: Decoration.none };
    const { nodes, blocks, references, tables, images } = cacheDocument(state, owner);
    const ranges = [],
      atomic = [];
    const read = (from, to) => state.sliceDoc(from, to);
    const selection = state.selection.main;
    const html = htmlRoots(state.doc);
    for (const root of html) {
      const range = Decoration.replace({
        widget: new HTMLWidget(root, owner.mode === 'reading'),
        block: root.block,
      }).range(root.from, root.to);
      // Markdown tables render their own inline HTML through their cell projections.
      if ([...tables.values()].some((table) => root.from >= table.from && root.to <= table.to))
        continue;
      ranges.push(range);
      atomic.push(range);
    }
    const active = [];
    if (owner.mode === 'live') {
      active.push({
        from: state.doc.lineAt(selection.from).from,
        to: state.doc.lineAt(selection.to).to,
      });
      for (const node of blocks.filter((node) => ['FencedCode', 'CodeBlock'].includes(node.name)))
        if (node.from <= selection.to && node.to >= selection.from)
          active.push({ from: state.doc.lineAt(node.from).from, to: state.doc.lineAt(node.to).to });
    }
    const editing = (from, to) => active.some((r) => r.from <= to && r.to >= from);
    const hide = (from, to) => {
      if (from < to) ranges.push(Decoration.replace({}).range(from, to));
    };
    const line = (position, className) =>
      ranges.push(Decoration.line({ class: className }).range(state.doc.lineAt(position).from));
    const mark = (from, to, className, attributes) => {
      if (from < to) ranges.push(Decoration.mark({ class: className, attributes }).range(from, to));
    };
    for (const node of nodes) {
      const { from, to, name } = node;
      if (html.some((root) => from >= root.from && to <= root.to)) continue;
      let container = node.parent;
      while (container && container.name !== 'Table') container = container.parent;
      if (container) continue;
      const inline = [
        'StrongEmphasis',
        'Emphasis',
        'Strikethrough',
        'InlineCode',
        'Link',
        'Autolink',
        'URL',
      ].includes(name)
        ? node
        : ['EmphasisMark', 'StrikethroughMark', 'CodeMark'].includes(name) &&
            ['StrongEmphasis', 'Emphasis', 'Strikethrough', 'InlineCode'].includes(
              node.parent?.name,
            )
          ? node.parent
          : null;
      const editingNode = inline
        ? inlineSpanActive(inline, selection, owner.mode === 'reading')
        : editing(from, to);
      if (name === 'Table') {
        const model = tables.get(from);
        if (model) {
          const range = Decoration.replace({
            widget: new TableWidget(owner, model, owner.mode === 'reading'),
            block: true,
            inclusive: false,
          }).range(model.from, model.to);
          ranges.push(range);
          atomic.push(range);
        }
      } else if (/^ATXHeading\d|^SetextHeading\d/.test(name))
        line(from, `md-heading md-h${name.at(-1)}`);
      else if (name === 'Paragraph') line(from, 'md-paragraph');
      else if (name === 'FencedCode' || name === 'CodeBlock') {
        for (
          let n = state.doc.lineAt(from).number, last = state.doc.lineAt(to).number;
          n <= last;
          n++
        )
          line(state.doc.line(n).from, 'md-code-line');
      } else if (name === 'Blockquote') {
        for (
          let n = state.doc.lineAt(from).number, last = state.doc.lineAt(to).number;
          n <= last;
          n++
        )
          line(state.doc.line(n).from, 'md-quote');
      } else if (name === 'ListItem') line(from, 'md-list-item');
      else if (name === 'StrongEmphasis') mark(from, to, 'md-strong');
      else if (name === 'Emphasis') mark(from, to, 'md-emphasis');
      else if (name === 'Strikethrough') mark(from, to, 'md-strike');
      else if (name === 'InlineCode') mark(from, to, 'md-inline-code');
      else if (name === 'HorizontalRule') {
        line(from, 'md-divider');
        if (!editingNode) {
          line(from, 'md-divider-preview');
          hide(from, to);
        }
      } else if (name === 'TaskMarker')
        ranges.push(
          Decoration.replace({
            widget: new CheckboxWidget(
              owner,
              from,
              /x/i.test(read(from, to)),
              owner.mode === 'reading',
            ),
          }).range(from, to),
        );
      else if (name === 'Image') {
        const parts = images.get(from);
        const range = Decoration.replace({
          widget: new ImageWidget(owner, parts, from, to, owner.mode === 'reading'),
        }).range(from, to);
        ranges.push(range);
        atomic.push(range);
      } else if (name === 'LinkReference' && !editingNode) {
        hide(from, to);
      } else if (!editingNode && (name === 'Escape' || name === 'Entity'))
        ranges.push(
          Decoration.replace({ widget: new TextWidget(read(from, to), true) }).range(from, to),
        );
      else if (name === 'ListMark' && !editingNode) {
        const raw = read(from, to);
        let label = '•';
        if (/^\d/.test(raw)) {
          const list = node.parent?.parent;
          let index = 0;
          for (
            let item = list?.firstChild;
            item && item.from < node.parent.from;
            item = item.nextSibling
          )
            if (item.name === 'ListItem') index++;
          const initial =
            state.sliceDoc(list.from, Math.min(list.from + 12, list.to)).match(/^\d+/)?.[0] ?? '1';
          label = `${Number(initial) + index}.`;
        }
        ranges.push(Decoration.replace({ widget: new TextWidget(label) }).range(from, to));
      } else if (name === 'Link' && !editingNode) {
        const parts = linkParts(node, read, references),
          url = safeLink(markdownText(parts.url));
        if (url) {
          hide(from, parts.from);
          hide(parts.to, to);
          mark(parts.from, parts.to, 'md-link', {
            'data-url': url,
            title: url,
            role: 'link',
            tabindex: '0',
          });
        }
      } else if (
        (name === 'Autolink' ||
          (name === 'URL' &&
            !['Link', 'Image', 'Autolink', 'LinkReference'].includes(node.parent?.name))) &&
        !editingNode
      ) {
        const raw = read(from, to),
          value = markdownText(raw.replace(/^<|>$/g, '')),
          url = safeLink(
            value.includes('@') && !value.includes('://')
              ? `mailto:${value}`
              : value.startsWith('www.')
                ? `https://${value}`
                : value,
          );
        if (url) {
          if (raw.startsWith('<')) {
            hide(from, from + 1);
            hide(to - 1, to);
          }
          mark(from + (raw.startsWith('<') ? 1 : 0), to - (raw.endsWith('>') ? 1 : 0), 'md-link', {
            'data-url': url,
            title: url,
            role: 'link',
            tabindex: '0',
          });
        }
      } else if (name === 'CodeMark' && node.parent?.name === 'FencedCode') {
        line(from, 'md-fence-line');
        if (!editingNode) hide(from, to);
      } else if (
        !editingNode &&
        [
          'HeaderMark',
          'EmphasisMark',
          'StrikethroughMark',
          'QuoteMark',
          'CodeMark',
          'CodeInfo',
        ].includes(name)
      ) {
        if (name === 'HeaderMark' || name === 'QuoteMark')
          hide(from, read(to, to + 1) === ' ' ? to + 1 : to);
        else hide(from, to);
      }
    }
    return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
  }
  return StateField.define({
    create: build,
    update: (value, tr) =>
      tr.docChanged ||
      tr.selection ||
      tr.effects.length ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state)
        ? build(tr.state)
        : value,
    provide: (field) => [
      EditorView.decorations.from(field, (value) => value.decorations),
      EditorView.atomicRanges.of((view) => view.state.field(field).atomic),
    ],
  });
}
