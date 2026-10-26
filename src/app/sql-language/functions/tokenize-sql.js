function tokenizeSql(source) {
  const tokens = [];
  let position = 0;
  while (position < source.length) {
    const start = position;
    const current = source[position];
    let kind;
    if (/\s/.test(current)) {
      kind = 'space';
      while (position < source.length && /\s/.test(source[position])) position++;
    } else if (source.startsWith('--', position)) {
      kind = 'comment';
      while (position < source.length && !/[\r\n]/.test(source[position])) position++;
    } else if (source.startsWith('/*', position)) {
      kind = 'comment';
      position += 2;
      let depth = 1;
      while (position < source.length && depth > 0) {
        if (source.startsWith('/*', position)) {
          depth++;
          position += 2;
        } else if (source.startsWith('*/', position)) {
          depth--;
          position += 2;
        } else position++;
      }
      if (depth > 0) throw new Error(`Unclosed block comment at character ${start + 1}.`);
    } else if (current === "'" || current === '"' || current === '[') {
      kind = current === "'" ? 'string' : 'quoted';
      const closing = current === '[' ? ']' : current;
      position++;
      let closed = false;
      while (position < source.length) {
        if (source[position] !== closing) {
          position++;
          continue;
        }
        if (source[position + 1] === closing) {
          position += 2;
          continue;
        }
        position++;
        closed = true;
        break;
      }
      if (!closed) throw new Error(`Unclosed quoted value at character ${start + 1}.`);
    } else if (/[\p{L}\p{N}_@#$]/u.test(current)) {
      kind = 'word';
      while (position < source.length && /[\p{L}\p{N}_@#$]/u.test(source[position])) position++;
    } else {
      kind = 'symbol';
      position++;
    }
    tokens.push({ kind, text: source.slice(start, position), start, end: position });
  }
  return tokens;
}
export { tokenizeSql };
