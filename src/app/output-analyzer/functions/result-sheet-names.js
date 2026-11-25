export function statementKeys(statements) {
  const counts = new Map();
  return new Map(
    statements.map((statement) => {
      const sql = statement.sql.trim();
      const occurrence = (counts.get(sql) ?? 0) + 1;
      counts.set(sql, occurrence);
      return [statement.index, JSON.stringify([sql, occurrence])];
    }),
  );
}

export function resultSheetNames(statements, custom = {}) {
  const keys = statementKeys(statements);
  const used = new Set(reservedNames);
  const results = statements.filter((statement) => statement.kind === 'SELECT');
  const named = new Map();
  for (const { index } of results) {
    const label = custom[keys.get(index)];
    if (label) named.set(index, availableName(label, used));
  }
  return new Map(
    results.map(({ index, tableName }) => [
      index,
      named.get(index) ?? availableName(tableName || `Statement #${index}`, used),
    ]),
  );
}

const lengthLimit = 31;
const reservedNames = ['HISTORY', '_STATEMENTS', '_DIAGNOSTICS', 'STATEMENTS', 'DIAGNOSTICS'];
const invalidCharacters = /[\\/*?:[\]\p{Cc}\p{Cs}]/u;
const endApostrophe = /^'|'$/;
const trimSheetName = (name) => name.replace(/^[\s']+|[\s']+$/g, '');
const shorten = (name, max) => name.slice(0, max).replace(/\p{Cs}$/u, '');

function availableName(label, used) {
  const base = trimSheetName(label.replace(new RegExp(invalidCharacters, 'gu'), '_')) || 'Result';
  let name = trimSheetName(shorten(base, lengthLimit)) || 'Result';
  let suffix = 2;
  while (used.has(name.toUpperCase())) {
    const tail = ` (${suffix++})`;
    name = shorten(base, lengthLimit - tail.length).trimEnd() + tail;
  }
  used.add(name.toUpperCase());
  return name;
}

export function sheetNameError(name, names, index) {
  if (!name) return 'Enter a worksheet name.';
  if (name.length > lengthLimit) return `Use ${lengthLimit} characters or fewer.`;
  if (invalidCharacters.test(name) || endApostrophe.test(name))
    return 'Worksheet names cannot contain \\ / ? * : [ ] or start or end with an apostrophe.';
  const key = name.toUpperCase();
  if (reservedNames.includes(key)) return 'That worksheet name is reserved.';
  for (const [otherIndex, otherName] of names)
    if (otherIndex !== index && otherName.toUpperCase() === key)
      return 'A worksheet with that name already exists.';
  return '';
}
