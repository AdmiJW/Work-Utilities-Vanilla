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
  const used = new Set();
  return new Map(
    statements
      .filter((statement) => statement.kind === 'SELECT')
      .map((statement) => {
        const base =
          custom[keys.get(statement.index)] ||
          statement.tableName ||
          `Statement #${statement.index}`;
        let name = base;
        let suffix = 2;
        while (used.has(name.toUpperCase())) name = `${base} (${suffix++})`;
        used.add(name.toUpperCase());
        return [statement.index, name];
      }),
  );
}

export function excelSheetName(label, used) {
  const base =
    label
      .replace(/[\\/*?:[\]]/g, '_')
      .replace(/\p{Cc}/gu, '_')
      .replace(/^'+|'+$/g, '')
      .slice(0, 31) || 'Result';
  let name = base;
  let suffix = 2;
  while (used.has(name.toUpperCase()) || name.toUpperCase() === 'HISTORY') {
    const tail = ` (${suffix++})`;
    name = base.slice(0, 31 - tail.length) + tail;
  }
  used.add(name.toUpperCase());
  return name;
}
