import { parseTree } from 'jsonc-parser';
const maximumStringLayers = 32;
function strictTree(source) {
  const errors = [];
  const tree = parseTree(source, errors, {
    disallowComments: true,
    allowTrailingComma: false,
    allowEmptyContent: false,
  });
  return tree && errors.length === 0 ? tree : null;
}
function unwrapSerializedJson(source, budget = maximumStringLayers) {
  let current = source;
  for (let layers = 0; layers <= budget; layers++) {
    const node = strictTree(current);
    if (!node) break;
    if (layers && (node.type === 'object' || node.type === 'array'))
      return { source: current, layers, limited: false };
    if (node.type !== 'string') break;
    if (
      typeof node.value !== 'string' ||
      !['{', '[', '"'].includes(node.value.trimStart()[0] ?? '')
    )
      break;
    if (layers === budget) return { source: null, layers, limited: true };
    current = node.value;
  }
  return { source: null, layers: 0, limited: false };
}
function deepDecodeJson(source) {
  let limited = false;
  function transform(text, node, layers) {
    if (node.type === 'string') {
      const decoded = unwrapSerializedJson(
        text.slice(node.offset, node.offset + node.length),
        maximumStringLayers - layers,
      );
      limited ||= decoded.limited;
      if (decoded.source !== null) {
        const tree = strictTree(decoded.source);
        return (
          decoded.source.slice(0, tree.offset) +
          transform(decoded.source, tree, layers + decoded.layers) +
          decoded.source.slice(tree.offset + tree.length)
        );
      }
    }
    const children =
      node.type === 'object'
        ? (node.children ?? []).map((property) => property.children[1])
        : node.type === 'array'
          ? (node.children ?? [])
          : [];
    let cursor = node.offset;
    const pieces = [];
    for (const child of children) {
      pieces.push(text.slice(cursor, child.offset), transform(text, child, layers));
      cursor = child.offset + child.length;
    }
    pieces.push(text.slice(cursor, node.offset + node.length));
    return pieces.join('');
  }
  try {
    const tree = strictTree(source);
    if (!tree) return { source, notice: '' };
    const decoded =
      source.slice(0, tree.offset) +
      transform(source, tree, 0) +
      source.slice(tree.offset + tree.length);
    return {
      source: decoded,
      notice: limited
        ? 'Deep decoding stopped at the 32-layer string limit. Unresolved strings remain unchanged.'
        : '',
    };
  } catch {
    return {
      source,
      notice: 'This value is too deeply nested to decode. Its raw text is unchanged.',
    };
  }
}
export { deepDecodeJson, unwrapSerializedJson };
