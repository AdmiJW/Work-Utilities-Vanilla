import { applyEdits, format, parseTree } from 'jsonc-parser';
import { unwrapSerializedJson } from './decode-serialized-json.js';
function mapNode(node, label) {
  const children =
    node.type === 'object'
      ? (node.children ?? []).map((property) =>
          mapNode(property.children[1], String(property.children[0].value)),
        )
      : (node.children ?? []).map((child, index) => mapNode(child, String(index)));
  return {
    kind: node.type,
    label,
    offset: node.offset,
    length: node.length,
    children,
  };
}
function inspectJson(source) {
  try {
    const errors = [];
    const node = parseTree(source, errors, {
      disallowComments: true,
      allowTrailingComma: false,
      allowEmptyContent: false,
    });
    if (!node || errors.length) {
      const first = errors[0];
      return {
        valid: false,
        root: null,
        pretty: '',
        error: first
          ? `This value may not be valid JSON (near character ${first.offset + 1}). You can still view and copy the raw value.`
          : 'This value may not be valid JSON. You can still view and copy the raw value.',
      };
    }
    return {
      valid: true,
      root: mapNode(node, '$'),
      pretty: applyEdits(
        source,
        format(source, void 0, { tabSize: 2, insertSpaces: true, eol: '\n' }),
      ),
      error: '',
    };
  } catch {
    return {
      valid: false,
      root: null,
      pretty: '',
      error: 'This value is too deeply nested to inspect. Its raw text is unchanged.',
    };
  }
}
function decodeNestedJson(source, node) {
  if (node.kind !== 'string') return null;
  try {
    const decoded = JSON.parse(source.slice(node.offset, node.offset + node.length));
    return typeof decoded === 'string' &&
      unwrapSerializedJson(source.slice(node.offset, node.offset + node.length)).source !== null
      ? decoded
      : null;
  } catch {
    return null;
  }
}
export { decodeNestedJson, inspectJson };
