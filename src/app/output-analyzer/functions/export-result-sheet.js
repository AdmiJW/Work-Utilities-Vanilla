export function resultSheetCsv(statement) {
  const csvRow = (values) =>
    values
      .map((value) =>
        /[,"\r\n]|^\s|\s$/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value,
      )
      .join(',');
  return (
    [
      csvRow(statement.columns.map(({ name }) => name)),
      ...statement.rows.map(({ values }) => csvRow(values)),
    ].join('\r\n') + '\r\n'
  );
}

function markdownCell(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/([\\`*_~[\]|])/g, '\\$1')
    .replace(/\r\n?|\n/g, '<br>');
}

export function resultSheetMarkdown(statement) {
  const markdownRow = (values) => '| ' + values.map(markdownCell).join(' | ') + ' |';
  let fenceLength = 3;
  for (const [backticks] of statement.sql.matchAll(/`+/g))
    fenceLength = Math.max(fenceLength, backticks.length + 1);
  const fence = '`'.repeat(fenceLength);
  return [
    fence + 'sql',
    statement.sql,
    fence,
    '',
    markdownRow(statement.columns.map(({ name }) => name)),
    markdownRow(statement.columns.map(() => '---')),
    ...statement.rows.map(({ values }) => markdownRow(values)),
    '',
  ].join('\n');
}
