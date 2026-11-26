import { applyEdits, createScanner, format, SyntaxKind } from 'jsonc-parser';

export function formatJson(source, indentWidth) {
  if (!source.trim()) throw new Error('Enter JSON to format.');
  // Validate without serializing parsed JavaScript values. Keep the original JSON tokens.
  JSON.parse(source);
  if (indentWidth !== undefined) {
    const text = source.trim();
    return applyEdits(
      text,
      format(text, undefined, { insertSpaces: true, tabSize: indentWidth, eol: '\n' }),
    );
  }

  const scanner = createScanner(source, true);
  const tokens = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EOF; kind = scanner.scan()) {
    const offset = scanner.getTokenOffset();
    tokens.push(source.slice(offset, offset + scanner.getTokenLength()));
  }
  return tokens.join('');
}
