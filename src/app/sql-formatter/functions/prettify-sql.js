import { format } from 'sql-formatter';
function prettifySql(source) {
  return format(source, { language: 'transactsql', tabWidth: 4, keywordCase: 'upper' });
}
export { prettifySql };
