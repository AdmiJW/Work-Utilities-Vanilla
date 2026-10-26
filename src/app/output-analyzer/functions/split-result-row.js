function findJsonEnd(row, start) {
  const first = row[start];
  if (first !== '{' && first !== '[' && first !== '"') return null;
  let inString = first === '"';
  const stack = first === '"' ? [] : [first];
  let escaped = false;
  for (let index = start + 1; index < row.length; index++) {
    const character = row[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') {
        inString = false;
        if (stack.length === 0) return index + 1;
      }
    } else if (character === '"') inString = true;
    else if (character === '{' || character === '[') stack.push(character);
    else if (character === '}' || character === ']') {
      const opening = stack.pop();
      if ((character === '}' && opening !== '{') || (character === ']' && opening !== '['))
        return null;
      if (stack.length === 0) return index + 1;
    }
  }
  return null;
}
function splitResultRow(row) {
  const fields = [];
  let start = 0;
  while (start <= row.length) {
    let candidateStart = start;
    while (candidateStart < row.length && /\s/.test(row[candidateStart])) candidateStart++;
    const jsonEnd = findJsonEnd(row, candidateStart);
    let separator = -1;
    if (jsonEnd !== null) {
      let next = jsonEnd;
      while (next < row.length && /\s/.test(row[next])) next++;
      if (next === row.length || row[next] === '|') {
        try {
          JSON.parse(row.slice(candidateStart, jsonEnd));
          separator = next;
        } catch {
          // Continue scanning when this candidate is not a complete JSON field.
        }
      }
    }
    if (separator < 0) {
      separator = row.indexOf('|', start);
      if (separator < 0) separator = row.length;
    }
    fields.push(row.slice(start, separator));
    if (separator === row.length) break;
    start = separator + 1;
  }
  return fields;
}
export { splitResultRow };
