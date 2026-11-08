/** Map a decoded text offset to source without allocating a per-character map. */
export function sourceOffset(raw, offset, decode) {
  let source = 0,
    rendered = 0;
  const tokens =
    /\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]|&(?:#[xX][\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z\d]+);/g;
  for (const match of raw.matchAll(tokens)) {
    const length = match.index - source;
    if (offset <= rendered + length) return source + Math.max(0, offset - rendered);
    rendered += length;
    source = match.index;
    const decoded = decode(match[0]);
    if (offset < rendered + decoded.length) return source;
    rendered += decoded.length;
    source += match[0].length;
    if (offset === rendered) return source;
  }
  return Math.min(raw.length, source + Math.max(0, offset - rendered));
}
