function prepareWorkbookSheets(result) {
  const sheets = result.statements
    .filter((statement) => statement.kind === 'SELECT')
    .map((statement) => ({
      name: [...`${String(statement.index).padStart(2, '0')} ${statement.tableName}`]
        .map((character) => ('\\/*?:[]'.includes(character) ? '_' : character))
        .join('')
        .slice(0, 31)
        .replace(/'+$/, ''),
      headerRow: 7,
      filterColumns: statement.columns.length,
      rows: [
        ['SQL Statement', statement.sql],
        ['Run marker', statement.marker],
        ['Observed rows', String(statement.observedRows)],
        ['Parsed rows', String(statement.rows.length)],
        [
          'Reported rows',
          statement.reportedRows === null ? 'Not reported' : String(statement.reportedRows),
        ],
        [],
        statement.columns.length
          ? statement.columns.map((column) => column.name)
          : ['Unsupported projection \u2014 raw output is in Diagnostics'],
        ...statement.rows.map((row) => row.values),
      ],
    }));
  const summaries = result.statements.filter((statement) => statement.kind !== 'SELECT');
  if (summaries.length)
    sheets.push({
      name: '_Statements',
      headerRow: 1,
      filterColumns: 6,
      rows: [
        ['Statement', 'Run marker', 'Kind', 'SQL', 'Reported rows', 'Messages'],
        ...summaries.map((statement) => [
          String(statement.index),
          statement.marker,
          statement.kind,
          statement.sql,
          statement.reportedRows === null ? 'Not reported' : String(statement.reportedRows),
          statement.messages.join('\n'),
        ]),
      ],
    });
  if (result.diagnostics.length)
    sheets.push({
      name: '_Diagnostics',
      headerRow: 1,
      filterColumns: 4,
      rows: [
        ['Statement', 'Source line', 'Reason', 'Raw text'],
        ...result.diagnostics.map((diagnostic) => [
          diagnostic.statementIndex === null ? '' : String(diagnostic.statementIndex),
          String(diagnostic.lineNumber),
          diagnostic.message,
          diagnostic.raw,
        ]),
      ],
    });
  return sheets;
}
function validateWorkbookSheets(sheets) {
  const issues = [];
  if (!sheets.length)
    issues.push({
      sheet: 'Workbook',
      row: 0,
      column: 0,
      message: 'There are no recognized statements to export.',
    });
  for (const sheet of sheets) {
    if (sheet.rows.length > 1048576)
      issues.push({
        sheet: sheet.name,
        row: 1048577,
        column: 1,
        message: 'This worksheet exceeds Excel\u2019s row limit, including metadata and headers.',
      });
    for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
      const row = sheet.rows[rowIndex];
      if (row.length > 16384)
        issues.push({
          sheet: sheet.name,
          row: rowIndex + 1,
          column: 16385,
          message: 'This row exceeds Excel\u2019s column limit.',
        });
      for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
        const value = row[columnIndex];
        if (value.length > 32767)
          issues.push({
            sheet: sheet.name,
            row: rowIndex + 1,
            column: columnIndex + 1,
            message: `${value.length.toLocaleString()} characters exceeds Excel\u2019s 32,767-character cell limit. The full value remains in the app.`,
          });
        else if ((value.match(/\n/g)?.length ?? 0) > 253)
          issues.push({
            sheet: sheet.name,
            row: rowIndex + 1,
            column: columnIndex + 1,
            message: 'This cell exceeds Excel\u2019s 253-line-feed limit.',
          });
      }
    }
  }
  return issues;
}
export { prepareWorkbookSheets, validateWorkbookSheets };
