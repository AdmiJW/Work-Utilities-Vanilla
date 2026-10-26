import ExcelJS from 'exceljs';
async function writeExcelWorkbook(sheets) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Work Utilities';
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    for (const values of sheet.rows) {
      const row = worksheet.addRow(values);
      row.eachCell((cell) => {
        cell.numFmt = '@';
        cell.alignment = { vertical: 'top' };
      });
    }
    worksheet.views = [{ state: 'frozen', ySplit: sheet.headerRow }];
    if (sheet.filterColumns)
      worksheet.autoFilter = {
        from: { row: sheet.headerRow, column: 1 },
        to: { row: sheet.headerRow, column: sheet.filterColumns },
      };
    const header = worksheet.getRow(sheet.headerRow);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    header.height = 24;
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(
        45,
        Math.max(18, (sheet.rows[sheet.headerRow - 1]?.[index]?.length ?? 16) + 3),
      );
    });
    if (sheet.headerRow > 1) {
      worksheet.getCell('B1').alignment = { wrapText: true, vertical: 'top' };
      worksheet.getRow(1).height = 38;
      for (let index = 1; index <= 5; index++)
        worksheet.getCell(index, 1).font = { bold: true, color: { argb: 'FF475569' } };
    }
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
export { writeExcelWorkbook };
