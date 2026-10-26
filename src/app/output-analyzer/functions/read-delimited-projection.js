import { significantSqlTokens } from '../../sql-language/public-api.js';
import { labelResultColumn } from './label-result-column.js';
function splitArguments(tokens) {
  const groups = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (token.text === ',' && depth === 0) groups.push([]);
    else groups[groups.length - 1].push(token);
  }
  return groups;
}
function literalValue(tokens) {
  const text = tokens.map((token) => token.text).join('');
  const match = /^N?'((?:''|[^'])*)'$/is.exec(text);
  return match ? match[1].replaceAll("''", "'") : null;
}
function unwrapIdentifier(value) {
  if (value.startsWith('[')) return value.slice(1, -1).replaceAll(']]', ']');
  if (value.startsWith('"')) return value.slice(1, -1).replaceAll('""', '"');
  return value;
}
function readDelimitedProjection(sql) {
  const tokens = significantSqlTokens(sql);
  let depth = 0;
  let select = -1;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (depth === 0 && token.text.toUpperCase() === 'SELECT') {
      select = index;
      break;
    }
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
  }
  if (select < 0) throw new Error('No outer SELECT projection was found.');
  let call = select + 1;
  if (/^(DISTINCT|ALL)$/i.test(tokens[call]?.text ?? '')) call++;
  if (tokens[call]?.text.toUpperCase() === 'TOP') {
    call++;
    if (tokens[call]?.text === '(') {
      let topDepth = 0;
      do {
        if (tokens[call]?.text === '(') topDepth++;
        if (tokens[call]?.text === ')') topDepth--;
        call++;
      } while (call < tokens.length && topDepth > 0);
    } else call++;
    if (tokens[call]?.text.toUpperCase() === 'PERCENT') call++;
    if (
      tokens[call]?.text.toUpperCase() === 'WITH' &&
      tokens[call + 1]?.text.toUpperCase() === 'TIES'
    )
      call += 2;
  }
  const functionName = tokens[call]?.text.toUpperCase();
  if (!['CONCAT', 'CONCAT_WS'].includes(functionName ?? '') || tokens[call + 1]?.text !== '(') {
    throw new Error('Column recovery requires a single CONCAT or CONCAT_WS SELECT projection.');
  }
  let closing = call + 2;
  depth = 1;
  for (; closing < tokens.length; closing++) {
    if (tokens[closing].text === '(') depth++;
    if (tokens[closing].text === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error('The concatenation expression has unbalanced parentheses.');
  let after = closing + 1;
  if (tokens[after]?.text.toUpperCase() === 'AS') after += 2;
  else if (
    tokens[after] &&
    !['FROM', ';', 'WHERE', 'ORDER', 'UNION'].includes(tokens[after].text.toUpperCase())
  )
    after++;
  if (tokens[after]?.text === ',')
    throw new Error('Multiple SELECT output expressions are not supported by this log format.');
  const args = splitArguments(tokens.slice(call + 2, closing));
  let fields;
  if (functionName === 'CONCAT_WS') {
    if (literalValue(args[0] ?? []) !== '|')
      throw new Error('Only a constant pipe delimiter is supported in v1.');
    fields = args.slice(1);
  } else {
    fields = [[]];
    let delimiters = 0;
    for (const argument of args) {
      if (literalValue(argument) === '|') {
        fields.push([]);
        delimiters++;
      } else fields[fields.length - 1].push(...argument);
    }
    if (delimiters === 0 && args.length > 1)
      throw new Error('No standalone pipe separator could be inferred from CONCAT.');
  }
  const counts = /* @__PURE__ */ new Map();
  const columns = fields.map((field, index) => {
    const expression = field.length ? sql.slice(field[0].start, field.at(-1).end).trim() : '';
    const label = labelResultColumn(field, expression, index);
    const count = (counts.get(label) ?? 0) + 1;
    counts.set(label, count);
    return { name: count === 1 ? label : `${label} (${count})`, expression };
  });
  let tableName = 'Query';
  depth = 0;
  for (let index = closing + 1; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (depth === 0 && token.text.toUpperCase() === 'FROM') {
      let identifier = index + 1;
      if (tokens[identifier]?.text === '(') break;
      while (tokens[identifier + 1]?.text === '.') identifier += 2;
      tableName = unwrapIdentifier(tokens[identifier]?.text ?? 'Query');
      break;
    }
  }
  return { columns, tableName };
}
export { readDelimitedProjection };
