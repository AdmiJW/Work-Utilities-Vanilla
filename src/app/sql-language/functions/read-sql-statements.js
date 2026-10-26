import { tokenizeSql } from './tokenize-sql.js';
function significantSqlTokens(source) {
  return tokenizeSql(source).filter((token) => token.kind !== 'space' && token.kind !== 'comment');
}
function readSqlStatements(source) {
  const statements = [];
  let statement = [];
  for (const token of tokenizeSql(source)) {
    if (token.kind === 'symbol' && token.text === ';') {
      if (statement.some((item) => item.kind !== 'space' && item.kind !== 'comment'))
        statements.push(statement);
      statement = [];
    } else statement.push(token);
  }
  if (statement.some((item) => item.kind !== 'space' && item.kind !== 'comment'))
    statements.push(statement);
  return statements;
}
function getSqlStatementKind(source) {
  let depth = 0;
  for (const token of significantSqlTokens(source)) {
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (
      depth === 0 &&
      /^(SELECT|INSERT|UPDATE|DELETE|MERGE|DECLARE|BEGIN|IF|EXEC|CREATE|ALTER|DROP|GO)$/i.test(
        token.text,
      )
    )
      return token.text.toUpperCase();
  }
  return 'UNKNOWN';
}
export { getSqlStatementKind, readSqlStatements, significantSqlTokens };
