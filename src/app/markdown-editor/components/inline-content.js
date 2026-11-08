import { element } from '../../shared/dom.js';
import { markdownParser, linkParts, safeLink } from '../functions/markdown.js';
import { isCellBreak } from '../functions/cell-projection.js';

export function markdownText(text) {
  return text
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
    .replace(/&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z\d]+);/g, (entity) => {
      // Only a single entity token reaches this inert decoder, never HTML markup.
      const decoder = document.createElement('textarea');
      decoder.innerHTML = entity;
      return decoder.value;
    });
}
const plain = markdownText;

export function renderInline(text, references = new Map(), image = null, mapping = null) {
  // A harmless prefix forces an inline context even for cells beginning with
  // heading/list/fence characters; the prefix itself is never rendered.
  const source = 'x ' + text;
  const read = (from, to) => source.slice(from, to);
  const fragment = document.createDocumentFragment();
  const tree = markdownParser.parse(source);
  function append(host, raw, from, literal = false) {
    const node = document.createTextNode(literal ? raw : plain(raw));
    mapping?.text.set(node, { raw, from: from - 2, literal });
    host.append(node);
  }
  function children(node, host, start = node.from, end = node.to) {
    let position = start;
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.to <= start || c.from >= end) continue;
      if (c.from > position) append(host, read(position, c.from), position);
      if (['EmphasisMark', 'StrikethroughMark', 'CodeMark'].includes(c.name)) {
        /* hidden delimiter */
      } else if (['StrongEmphasis', 'Emphasis', 'Strikethrough', 'InlineCode'].includes(c.name)) {
        const tag = {
          StrongEmphasis: 'strong',
          Emphasis: 'em',
          Strikethrough: 's',
          InlineCode: 'code',
        }[c.name];
        const wrapper = element(tag);
        if (c.name === 'InlineCode')
          append(
            wrapper,
            read(c.firstChild.to, c.lastChild.from).replace(/\n/g, ' '),
            c.firstChild.to,
            true,
          );
        else children(c, wrapper);
        host.append(wrapper);
      } else if (c.name === 'Link' || c.name === 'Image') {
        const parts = linkParts(c, read, references);
        if (c.name === 'Image') {
          const object = image
            ? image(parts, { from: c.from - 2, to: c.to - 2 })
            : element('span', { className: 'md-image-placeholder' }, parts.label || 'Image');
          mapping?.objects.set(object, { from: c.from - 2, to: c.to - 2 });
          host.append(object);
        } else {
          const url = safeLink(plain(parts.url));
          if (url) {
            const a = element('a', { href: url, target: '_blank', rel: 'noopener noreferrer' });
            children(c, a, parts.from, parts.to);
            host.append(a);
          } else append(host, read(c.from, c.to), c.from);
        }
      } else if (c.name === 'Autolink' || c.name === 'URL') {
        const value = plain(read(c.from, c.to).replace(/^<|>$/g, ''));
        const url = safeLink(
          value.includes('@') && !value.includes('://')
            ? `mailto:${value}`
            : value.startsWith('www.')
              ? `https://${value}`
              : value,
        );
        if (url) {
          const anchor = element('a', { href: url, target: '_blank', rel: 'noopener noreferrer' });
          const raw = read(c.from, c.to),
            angle = raw.startsWith('<');
          append(anchor, angle ? raw.slice(1, -1) : raw, c.from + (angle ? 1 : 0));
          host.append(anchor);
        } else append(host, read(c.from, c.to), c.from);
      } else if (
        c.name === 'HardBreak' ||
        (mapping && c.name === 'HTMLTag' && isCellBreak(read(c.from, c.to)))
      ) {
        const br = element('br');
        mapping?.objects.set(br, { from: c.from - 2, to: c.to - 2 });
        host.append(br);
        if (c.to === end) {
          const text = document.createTextNode('\u200b');
          mapping?.text.set(text, { raw: '', from: c.to - 2, literal: false });
          host.append(element('span', { 'aria-hidden': true, className: 'md-break-end' }, text));
        }
      } else append(host, read(c.from, c.to), c.from);
      position = c.to;
    }
    if (position < end) append(host, read(position, end), position);
  }
  if (tree.topNode.firstChild?.name === 'Paragraph' && !tree.topNode.firstChild.nextSibling)
    children(tree.topNode.firstChild, fragment, 2);
  else append(fragment, text, 2);
  return fragment;
}
