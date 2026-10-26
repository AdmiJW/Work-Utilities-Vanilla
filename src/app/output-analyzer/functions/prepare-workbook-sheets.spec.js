import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { writeExcelWorkbook } from '../adapters/write-excel-workbook.js';
import { parseOutputFile } from './parse-output-file.js';
import { prepareWorkbookSheets, validateWorkbookSheets } from './prepare-workbook-sheets.js';
describe('workbook export', () => {
  it('round-trips raw text, leading zeros, formulas, large integers and timestamps', async () => {
    const values = [
      '000123',
      '9007199254740993123456789',
      '=SUM(1,2)',
      '2026-10-01 09:15:30.1234567 +08:00',
    ];
    const result = parseOutputFile(
      `SQL Statement Run: --00001SELECT CONCAT_WS('|', Id, BigId, Text, Timestamp) FROM Records
${values.join('|')}`,
    );
    const sheets = prepareWorkbookSheets(result);
    expect(validateWorkbookSheets(sheets)).toEqual([]);
    const buffer = await writeExcelWorkbook(sheets);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets).toHaveLength(1);
    values.forEach((value, index) => {
      const cell = workbook.worksheets[0].getCell(8, index + 1);
      expect(cell.value).toBe(value);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.numFmt).toBe('@');
    });
  });
  it('includes unresolved raw rows and non-SELECT summaries in dedicated sheets', () => {
    const result = parseOutputFile(
      "SQL Statement Run: --1SELECT CONCAT_WS('|',a,b) FROM T\nwrong\nSQL Statement Run: --1UPDATE T SET x=1;\n2 rows affected",
    );
    const sheets = prepareWorkbookSheets(result);
    expect(sheets.map((sheet) => sheet.name)).toEqual(['01 T', '_Statements', '_Diagnostics']);
    expect(sheets[2].rows[1][3]).toBe('wrong');
    expect(sheets[1].rows[1][4]).toBe('2');
  });
  it('blocks oversized cells with exact worksheet coordinates', () => {
    const oversized = 'x'.repeat(32768);
    const result = parseOutputFile(
      `SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM T
001|${oversized}`,
    );
    const issues = validateWorkbookSheets(prepareWorkbookSheets(result));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ sheet: '01 T', row: 8, column: 2 });
    expect(result.statements[0].rows[0].values[1]).toBe(oversized);
  });
});
