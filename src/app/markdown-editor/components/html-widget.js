import DOMPurify from 'dompurify';
import { WidgetType } from '@codemirror/view';
import { safeLink } from '../functions/markdown.js';
import { readEmbeddedImage } from '../functions/images.js';

const forbidden = [
  'script',
  'style',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'option',
  'iframe',
  'object',
  'embed',
  'template',
  'link',
  'meta',
  'base',
  'dialog',
  'audio',
  'video',
  'source',
];
const styleProperties =
  /^(color|background-color|font-(family|size|style|weight|variant)|line-height|letter-spacing|word-spacing|text-(align|decoration|transform|indent)|white-space|vertical-align|border(-(top|right|bottom|left))?(-(color|style|width))?|border-(collapse|spacing|radius)|margin(-(top|right|bottom|left))?|padding(-(top|right|bottom|left))?)$/;

/** Original markup is never rewritten: only this detached preview is sanitized. */
export function createHTMLDOM(raw, block = false, reading = false) {
  const host = document.createElement(block ? 'div' : 'span');
  host.className = 'md-html-unit';
  host.contentEditable = 'false';
  host.setAttribute('aria-label', 'HTML element (edit in Source)');
  host.title = 'HTML element · edit in Source';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    ':host{max-width:100%;overflow-wrap:anywhere;color:inherit;font:inherit}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid var(--border,#888);padding:6px}pre{white-space:pre-wrap}a{color:var(--accent,#5685da)}.offline-image{font-size:.85em;border:1px dashed currentColor;padding:4px}';
  const fragment = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: forbidden,
    FORBID_ATTR: ['srcset', 'background', 'poster', 'contenteditable', 'autofocus', 'tabindex'],
    ALLOW_DATA_ATTR: false,
    SANITIZE_NAMED_PROPS: true,
  });
  for (const node of fragment.querySelectorAll('*')) {
    if (node.hasAttribute('style')) {
      const input = node.style,
        output = document.createElement('span').style;
      for (const key of input) {
        const value = input.getPropertyValue(key);
        if (
          styleProperties.test(key) &&
          !/url\s*\(|var\s*\(|env\s*\(|expression\s*\(|[\\@]/i.test(value)
        )
          output.setProperty(key, value);
      }
      node.removeAttribute('style');
      if (output.cssText) node.setAttribute('style', output.cssText);
    }
    if (node.tagName === 'IMG' && !readEmbeddedImage(node.getAttribute('src') ?? '')) {
      const fallback = document.createElement('span');
      fallback.className = 'offline-image';
      fallback.textContent = `Image unavailable offline${node.alt ? ': ' + node.alt : ''}`;
      node.replaceWith(fallback);
    } else if (node.tagName !== 'IMG') node.removeAttribute('src');
    if (node.tagName === 'A') {
      const url = safeLink(node.getAttribute('href') ?? '');
      node.removeAttribute('href');
      if (url) {
        node.href = url;
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
        node.addEventListener('click', (event) => {
          if (!reading && !event.ctrlKey && !event.metaKey) event.preventDefault();
        });
      }
    }
  }
  if (!fragment.childNodes.length)
    fragment.append(document.createTextNode('[HTML content excluded from preview]'));
  shadow.append(style, fragment);
  return host;
}

export class HTMLWidget extends WidgetType {
  constructor(root, reading = false) {
    super();
    this.root = root;
    this.reading = reading;
  }
  eq(other) {
    return (
      this.root.raw === other.root.raw &&
      this.root.block === other.root.block &&
      this.reading === other.reading
    );
  }
  toDOM() {
    return createHTMLDOM(this.root.raw, this.root.block, this.reading);
  }
  ignoreEvent() {
    return true;
  }
}
