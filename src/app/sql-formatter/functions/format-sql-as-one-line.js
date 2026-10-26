import { getSqlStatementKind, readSqlStatements } from '../../sql-language/public-api.js';
function formatSqlAsOneLine(source) {
  return readSqlStatements(source)
    .map((tokens) => {
      const original = tokens.map((token) => token.text).join('');
      if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(getSqlStatementKind(original))) {
        throw new Error(
          'One-line supports standalone SELECT, INSERT, UPDATE, and DELETE statements. Separate statements with semicolons.',
        );
      }
      let result = '';
      for (const token of tokens) {
        if (token.kind === 'space' || token.kind === 'comment') {
          if (result && !result.endsWith(' ')) result += ' ';
        } else {
          if (/[\r\n]/.test(token.text))
            throw new Error(
              'A quoted value contains a physical newline. Use an explicit CHAR(10)/CHAR(13) expression before compacting.',
            );
          if (
            token.kind === 'word' &&
            /^(GO|DECLARE|BEGIN|TRY|CATCH|TRANSACTION)$/i.test(token.text)
          ) {
            throw new Error(
              'Batch directives and procedural scripts are outside the one-line format.',
            );
          }
          result += token.text;
        }
      }
      return `${result.trim()};`;
    })
    .join('\n');
}
export { formatSqlAsOneLine };
