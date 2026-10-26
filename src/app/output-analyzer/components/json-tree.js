import { element, button } from '../../shared/dom.js';
import { decodeNestedJson } from '../functions/inspect-json.js';

/** Expand children on demand; values always remain source substrings. */
export function renderJsonTree(node, source, inspectNested, depth = 0) {
  const container = node.kind === 'object' || node.kind === 'array';
  const raw = source.slice(node.offset, node.offset + node.length);
  const wrapper = element('div', { className: 'json-tree' });
  const row = element('div', { className: 'tree-row' });
  row.style.paddingLeft = `${Math.min(depth, 40) * 14}px`;
  const children = element('div', { className: 'tree-children' });
  let expanded = depth === 0;
  let populated = false;
  const toggle = container
    ? button(
        expanded ? '⌄' : '›',
        () => {
          expanded = !expanded;
          update();
        },
        { className: 'tree-toggle' },
      )
    : element('span', { className: 'tree-spacer' });
  const preview = container
    ? `${node.kind === 'object' ? '{' : '['} ${node.children.length} ${node.kind === 'object' ? 'keys' : 'items'} ${node.kind === 'object' ? '}' : ']'}`
    : raw.length > 180
      ? `${raw.slice(0, 180)}…`
      : raw;
  row.append(
    toggle,
    element('span', { className: 'property' }, node.label),
    element('span', { className: 'punctuation' }, ':'),
    element(
      'span',
      { className: container ? 'container-value' : `scalar ${node.kind}`, title: raw },
      preview,
    ),
  );
  const nested = decodeNestedJson(source, node);
  if (nested)
    row.append(
      button('Decode', () => inspectNested(nested), {
        className: 'decode-button',
        title: 'Inspect JSON encoded inside this string',
      }),
    );
  wrapper.append(row, children);
  function update() {
    if (!container) return;
    toggle.textContent = expanded ? '⌄' : '›';
    toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${node.label}`);
    toggle.setAttribute('aria-expanded', String(expanded));
    children.hidden = !expanded;
    if (expanded && !populated) {
      populated = true;
      children.append(
        ...node.children.map((child) => renderJsonTree(child, source, inspectNested, depth + 1)),
      );
    }
  }
  update();
  return wrapper;
}
