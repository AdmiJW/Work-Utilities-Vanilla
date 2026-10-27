import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { openApp } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';

const first =
  'SQL Statement Run: --1SELECT Id,Message,Payload FROM dbo.Events;\n001|Packed item|{"note":"Box | fragile"}\n002|Other message|{"note":"ordinary"}\n003|box fragile|true';
const second = 'SQL Statement Run: --1SELECT Id FROM dbo.Events;\n004';
const third = 'SQL Statement Run: --1SELECT * FROM (SELECT * FROM dbo.Events) AS e;\na|b\nc|d|e\nx';
async function analyze(page, source) {
  await page.getByRole('textbox', { name: 'Execution output', exact: true }).fill(source);
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
}
async function showInput(page) {
  if (!(await page.getByRole('textbox', { name: 'Execution output', exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Source output', exact: true }).click();
}

test('table-local literal search, inline sheet labels, full Excel Tables and identity-based reanalysis persist', async ({
  page,
}, info) => {
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await analyze(page, [first, second, third].join('\n'));
  const tabs = page.getByRole('tablist', { name: 'Result sheets', exact: true });
  await expect(tabs.getByRole('tab')).toHaveText([
    'Events3',
    'Events (2)1',
    'Statement #33',
    'Diagnostics3',
  ]);
  const search = page.getByRole('searchbox', { name: 'Search this table', exact: true });
  await search.evaluate((input) => {
    input.value = 'Other message';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-sheet-id="2"]').click();
  });
  await tabs.locator('[data-sheet-id="1"]').click();
  await expect(search).toHaveValue('Other message');
  await expect(page.locator('.search-count')).toHaveText('1 / 3 rows');
  await search.fill('box | FRAGILE');
  await expect(page.locator('.search-count')).toHaveText('1 / 3 rows');
  await expect(page.locator('.ag-cell[col-id="0"]')).toHaveText(['001']);
  await tabs.locator('[data-sheet-id="2"]').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.search-count')).toHaveText('1 / 1 rows');
  await tabs.locator('[data-sheet-id="1"]').click();
  await expect(search).toHaveValue('box | FRAGILE');
  await expect(page.locator('.search-count')).toHaveText('1 / 3 rows');
  await tabs.locator('[data-sheet-id="1"]').dblclick();
  await page
    .getByRole('textbox', { name: 'Result sheet name', exact: true })
    .fill('Evidence export');
  await page.keyboard.press('Enter');
  await expect(tabs.locator('[data-sheet-id="1"]')).toContainText('Evidence export');
  const filename = page.getByRole('textbox', { name: 'Export filename', exact: true });
  await filename.fill('Investigation results');
  await filename.press('Enter');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('Investigation results.xlsx');
  const path = info.outputPath('searched-results.xlsx');
  await download.saveAs(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet('Evidence export');
  expect(sheet.getTable('Result_1').table.tableRef).toBe('A7:C10');
  expect(sheet.getCell('A8').value).toBe('001');
  expect(sheet.getCell('A10').value).toBe('003');
  expect(sheet.getCell('C8').value).toBe('{"note":"Box | fragile"}');
  expect(workbook.getWorksheet('_Diagnostics').getTable('DiagnosticData')).toBeTruthy();
  await page.getByRole('button', { name: 'Close Output Analyzer 01', exact: true }).click();
  await page.getByRole('button', { name: 'Reopen Output Analyzer 01', exact: true }).click();
  await expect(tabs.locator('[data-sheet-id="1"]')).toContainText('Evidence export');
  await expect(search).toHaveValue('box | FRAGILE');
  await page.reload();
  await expect(search).toHaveValue('box | FRAGILE');
  await expect(filename).toHaveValue('Investigation results');
  await showInput(page);
  await analyze(page, [second, first, third].join('\n'));
  await expect(tabs.locator('[data-sheet-id="2"]')).toContainText('Evidence export');
  await tabs.locator('[data-sheet-id="2"]').click();
  await expect(search).toHaveValue('box | FRAGILE');
  await page.getByRole('button', { name: 'Clear table search', exact: true }).click();
  await expect(page.locator('.search-count')).toHaveText('3 / 3 rows');
  await showInput(page);
  await analyze(page, [second, first.replace('dbo.Events', 'dbo.OtherEvents'), third].join('\n'));
  await expect(tabs).not.toContainText('Evidence export');
});

test('generic fallback retains every row, non-JSON messages are readable, notices dismiss, and inspector toggle sits near the bottom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await openFile(page, 'Open TXT', 'fallback.txt', Buffer.from(third));
  await expect(page.getByRole('textbox', { name: 'Export filename', exact: true })).toHaveValue(
    'fallback',
  );
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Column 3', exact: true })).toBeVisible();
  await expect(page.locator('.ag-cell[col-id="0"]')).toHaveText(['a', 'c', 'x']);
  const toggle = page.getByRole('button', { name: 'Open cell inspector', exact: true });
  const position = await toggle.boundingBox();
  const stage = await page.locator('.results-stage').boundingBox();
  expect(stage.y + stage.height - position.y - position.height).toBeCloseTo(80, 0);
  await toggle.click();
  await expect(page.getByRole('alert')).toContainText('Select a data cell');
  await page.getByRole('button', { name: 'Dismiss analyzer notice', exact: true }).click();
  await expect(page.locator('.analyzer-notice')).toBeHidden();
  await toggle.click();
  await expect(page.locator('.analyzer-notice')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss analyzer notice', exact: true }).click();
  await page.locator('.ag-cell[col-id="0"]').first().dblclick();
  await expect(
    page.locator('.inspection-hint').filter({ hasText: 'may not be valid JSON' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue('a');
  await expect(page.getByRole('button', { name: 'Copy JSON', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Cell inspector', exact: true })).not.toContainText(
    /EndOfFileExpected|InvalidSymbol/,
  );
});
