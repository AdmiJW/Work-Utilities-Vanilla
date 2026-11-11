import { htmlLanguage } from '@codemirror/lang-html';
import { markdownParser } from './markdown.js';

const blockTags = new Set(
  'address article aside blockquote details dialog div dl dt dd fieldset figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr li main nav ol p pre section summary table tbody td th thead tr ul'.split(
    ' ',
  ),
);
const cache = new WeakMap();

/** Markdown determines where tags are real; the HTML parser supplies balanced roots. */
export function readHTMLRoots(text, inlineOnly = false) {
  if (!/<\/?[a-zA-Z]/.test(text)) return [];
  const allowed = [];
  markdownParser.parse(text).iterate({
    enter(ref) {
      if (['FencedCode', 'CodeBlock', 'InlineCode', 'Image', 'URL', 'Autolink'].includes(ref.name))
        return false;
      if (ref.name === 'HTMLBlock' || ref.name === 'HTMLTag') {
        allowed.push({ from: ref.from, to: ref.to });
        return false;
      }
    },
  });
  if (!allowed.length) return [];
  let index = 0;
  const masked = text.replace(/</g, (value, offset) => {
    while (allowed[index] && allowed[index].to <= offset) index++;
    return allowed[index] && allowed[index].from <= offset ? value : ' ';
  });
  const roots = [];
  const tree = htmlLanguage.parser.parse(masked);
  for (let node = tree.topNode.firstChild; node; node = node.nextSibling) {
    if (node.name !== 'Element') continue;
    let valid = true,
      block = false;
    const visit = (element) => {
      const open = element.firstChild,
        close = element.lastChild;
      if (
        !['OpenTag', 'SelfClosingTag'].includes(open?.name) ||
        (open.name !== 'SelfClosingTag' && close?.name !== 'CloseTag')
      )
        valid = false;
      const name = open?.getChild('TagName');
      const tag = name ? text.slice(name.from, name.to).toLowerCase() : '';
      if (blockTags.has(tag)) block = true;
      if (close?.name === 'CloseTag') {
        const closing = close.getChild('TagName');
        if (!closing || text.slice(closing.from, closing.to).toLowerCase() !== tag) valid = false;
      }
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.type.isError) valid = false;
        if (child.name === 'Element') visit(child);
      }
    };
    visit(node);
    const raw = text.slice(node.from, node.to);
    if (valid && !(inlineOnly && block))
      roots.push({
        from: node.from,
        to: node.to,
        raw,
        inline: !block,
        block: block || raw.includes('\n'),
      });
  }
  return roots;
}

export function htmlRoots(doc, inlineOnly = false) {
  let value = cache.get(doc);
  if (!value) {
    value = readHTMLRoots(doc.toString());
    cache.set(doc, value);
  }
  return inlineOnly ? value.filter((root) => root.inline) : value;
}
