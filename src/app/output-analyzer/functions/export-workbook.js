import { prepareWorkbookSheets, validateWorkbookSheets } from './prepare-workbook-sheets.js';
import { writeExcelWorkbook } from '../adapters/write-excel-workbook.js';
export async function exportWorkbook({ result, customNames }) {
  const sheets = prepareWorkbookSheets(result, customNames);
  const issues = validateWorkbookSheets(sheets);
  if (issues.length) return { issues };
  return { buffer: await writeExcelWorkbook(sheets), issues: [] };
}
