import { significantSqlTokens } from '../../sql-language/public-api.js';
import { readDelimitedProjection } from './read-delimited-projection.js';
import { labelResultColumn } from './label-result-column.js';

function outerSelect(tokens) {
  let depth = 0;
  return tokens.findIndex((token) => {
    if (depth === 0 && token.text.toUpperCase() === 'SELECT') return true;
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    return false;
  });
}

function sourceName(tokens, select) {
  let depth = 0;
  for (let index = select + 1; index < tokens.length; index++) {
    const text = tokens[index].text;
    if (!depth && text.toUpperCase() === 'FROM') {
      let next = index + 1;
      if (!['word', 'quoted'].includes(tokens[next]?.kind) || tokens[next].text.startsWith('@'))
        return null;
      while (tokens[next + 1]?.text === '.') next += 2;
      if (tokens[next + 1]?.text === '(') return null;
      const name = tokens[next]?.text;
      return name?.startsWith('[')
        ? name.slice(1, -1).replaceAll(']]', ']')
        : name?.startsWith('"')
          ? name.slice(1, -1).replaceAll('""', '"')
          : name;
    }
    if (text === '(') depth++;
    if (text === ')') depth--;
  }
  return null;
}

function uniqueColumns(groups, sql) {
  const used = new Set();
  return groups.map((tokens, index) => {
    const expression = sql.slice(tokens[0].start, tokens.at(-1).end).trim();
    let name = labelResultColumn(tokens, expression, index);
    const last = tokens.at(-1);
    const previous = tokens.at(-2);
    if (
      name === expression &&
      tokens.length > 1 &&
      ['word', 'quoted'].includes(last.kind) &&
      (previous?.text === ')' ||
        previous?.text.toUpperCase() === 'END' ||
        ['word', 'quoted', 'string'].includes(previous?.kind)) &&
      !['END', 'NULL', 'ASC', 'DESC'].includes(last.text.toUpperCase())
    )
      name = last.text;
    const base = name;
    let suffix = 2;
    while (used.has(name.toUpperCase())) name = `${base} (${suffix++})`;
    used.add(name.toUpperCase());
    return { name, expression };
  });
}

export function readResultProjection(sql) {
  const tokens = significantSqlTokens(sql);
  const select = outerSelect(tokens);
  const tableName = select < 0 ? null : sourceName(tokens, select);
  try {
    return { ...readDelimitedProjection(sql), tableName, generic: false };
  } catch {
    /* Ordinary SELECT lists and generic fallback are handled below. */
  }
  const generic = { columns: [], tableName, generic: true };
  if (select < 0) return generic;
  let start = select + 1;
  if (/^(DISTINCT|ALL)$/i.test(tokens[start]?.text ?? '')) start++;
  if (tokens[start]?.text.toUpperCase() === 'TOP') {
    start++;
    if (tokens[start]?.text === '(') {
      let depth = 0;
      do {
        if (tokens[start]?.text === '(') depth++;
        if (tokens[start]?.text === ')') depth--;
        start++;
      } while (start < tokens.length && depth);
    } else start++;
    if (tokens[start]?.text.toUpperCase() === 'PERCENT') start++;
    if (
      tokens[start]?.text.toUpperCase() === 'WITH' &&
      tokens[start + 1]?.text.toUpperCase() === 'TIES'
    )
      start += 2;
  }
  const groups = [[]];
  let depth = 0;
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index];
    if (
      !depth &&
      /^(FROM|WHERE|GROUP|ORDER|HAVING|UNION|EXCEPT|INTERSECT|FOR|OPTION|INTO|;)$/.test(
        token.text.toUpperCase(),
      )
    )
      break;
    if (!depth && token.text === ',') groups.push([]);
    else groups.at(-1).push(token);
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
  }
  if (
    depth ||
    groups.some(
      (group) =>
        !group.length ||
        /^(?:[^(),\s]+\.)?\*$/.test(group.map((token) => token.text).join('')) ||
        /^(CONCAT|CONCAT_WS)$/i.test(group[0]?.text),
    )
  )
    return generic;
  return { columns: uniqueColumns(groups, sql), tableName, generic: false };
}
