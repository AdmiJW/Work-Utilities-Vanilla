import { openApp, openLocalFile } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
async function openAnalyzer(page, source) {
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Execution output', exact: true }).fill(source);
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
}
test('JSON sheets, nested inspection, sorting/filtering, full workbook export and restoration', async ({
  page,
}, info) => {
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const origin = new URL(info.project.use.baseURL ?? 'http://127.0.0.1:4173').origin;
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin)
      externalRequests.push(request.url());
  });
  const source = await readFile(
    'examples/der-dpr-output analyzer/example_02_json_events.txt',
    'utf8',
  );
  await openAnalyzer(page, source);
  await expect(page.getByRole('tab', { name: /^WebhookEvent/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^FailedWebhook/ })).toBeVisible();
  const headerCell = page.locator('.ag-cell[col-id="3"]').filter({ hasText: 'trace-7d91' });
  await headerCell.dblclick();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue(
    /\\"Origin\\"/,
  );
  await page.getByRole('button', { name: 'Decode', exact: true }).click();
  await expect(page.getByText('Decoded string \xB7 depth 1', { exact: true })).toBeVisible();
  await expect(page.locator('.json-tree').getByText('Origin', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close cell inspector', exact: true }).click();
  await page.locator('.ag-cell[col-id="4"]').filter({ hasText: 'box | fragile' }).dblclick();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue(
    /box \| fragile/,
  );
  await page.getByRole('button', { name: 'Pretty', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Prettified JSON', exact: true })).toHaveValue(
    /"Label": "box \| fragile"/,
  );
  await page.getByRole('button', { name: /Raw value/ }).click();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Prettified JSON', exact: true })).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: `artifacts/analyzer-light-${info.project.name}.png` });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: `artifacts/analyzer-wide-light-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: `artifacts/analyzer-wide-dark-${info.project.name}.png` });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: `artifacts/analyzer-dark-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Close cell inspector', exact: true }).click();
  await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.getByRole('columnheader', { name: 'WebhookEvent.EventId', exact: true }).click();
  await page.getByRole('columnheader', { name: 'WebhookEvent.EventId', exact: true }).click();
  await expect(page.getByRole('grid').locator('[role="row"][aria-rowindex="2"]')).toContainText(
    'MSG-9002',
  );
  const topicHeader = page.locator('.ag-header-cell[col-id="2"]');
  await topicHeader.hover();
  await topicHeader.locator('.ag-header-cell-filter-button').click();
  await page.locator('.ag-filter input').first().fill('shipment.created');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(2);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  const output = info.outputPath('results.xlsx');
  await (await downloaded).saveAs(output);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(output);
  expect(workbook.creator).toBe('Work Utilities');
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'WebhookEvent',
    'DeliveryAttempt',
    'FailedWebhook',
  ]);
  expect(workbook.worksheets[0].getCell('A8').value).toBe('MSG-9001');
  expect(workbook.worksheets[0].getCell('A9').value).toBe('MSG-9002');
  expect(workbook.worksheets[0].getCell('E9').value).toEqual(
    expect.stringContaining('box | fragile'),
  );
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(2);
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
test('diagnostics, DPR summaries and oversized-cell export blocking', async ({ page }) => {
  const source =
    "SQL Statement Run: --00001SELECT CONCAT_WS('|',Id,Payload) FROM Demo\n001|good\nambiguous\nSQL Statement Run: --00001UPDATE Demo SET State=1;\n2 rows affected";
  await openAnalyzer(page, source);
  await page.getByRole('tab', { name: /Diagnostics/ }).click();
  await expect(page.getByText(/Expected 2 fields, found 1/)).toBeVisible();
  await page.getByRole('tab', { name: 'Statements', exact: true }).click();
  await expect(page.getByText('2 rows affected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Source output/ }).click();
  const oversized = 'z'.repeat(32768);
  await page.getByRole('textbox', { name: 'Execution output', exact: true })
    .fill(`SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM Demo
0001|${oversized}`);
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Excel export blocked');
  await expect(page.getByRole('alert')).toContainText('Demo, row 8, column 2');
  await expect(page.getByText(/32,768 characters exceeds/)).toBeVisible();
});
test('analyzer sessions keep independent sheets and restore the active result', async ({
  page,
}) => {
  await openAnalyzer(
    page,
    await readFile('examples/der-dpr-output analyzer/example_01_basic_results.txt', 'utf8'),
  );
  await page.getByRole('tab', { name: /^RefundRequest/ }).click();
  await expect(page.getByRole('tab', { name: /^RefundRequest/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Execution output', exact: true })
    .fill("SQL Statement Run: --2SELECT CONCAT_WS('|', Id, State) FROM SecondTable\n0002|ACTIVE");
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^SecondTable/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Output Analyzer 01', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^RefundRequest/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: /^Customer/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Output Analyzer 02', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: '0002', exact: true })).toBeVisible();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Output Analyzer 02', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('gridcell', { name: '0002', exact: true })).toBeVisible();
});
test('a representative 20 MB file analyzes while the interface remains responsive', async ({
  page,
}, info) => {
  test.setTimeout(12e4);
  const rowCount = 5e4;
  const value = JSON.stringify({
    number: '9007199254740993123456789',
    label: 'box | fragile',
    padding: 'a'.repeat(305),
  });
  const lines = Array.from(
    { length: rowCount },
    (_, index) => `${String(index).padStart(7, '0')}|${value}`,
  );
  const source =
    "SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM PerformanceData\n" +
    lines.join('\n');
  const inputFile = info.outputPath('representative-output.txt');
  await writeFile(inputFile, source);
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await openLocalFile(page, 'Open TXT', inputFile);
  await expect(page.getByRole('button', { name: 'Analyze output', exact: true })).toBeEnabled();
  const started = Date.now();
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('dark', { timeout: 3e3 });
  await expect(
    page.getByText('50,000 parsed / 50,000 observed rows \xB7 2 columns', { exact: true }),
  ).toBeVisible({
    timeout: 3e4,
  });
  const duration = Date.now() - started;
  const exportStarted = Date.now();
  const download = page.waitForEvent('download', { timeout: 6e4 });
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass('dark', { timeout: 3e3 });
  const workbookPath = info.outputPath('representative-results.xlsx');
  await (await download).saveAs(workbookPath);
  const exportDuration = Date.now() - exportStarted;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  expect(workbook.worksheets[0].rowCount).toBe(rowCount + 7);
  expect(workbook.worksheets[0].getCell(rowCount + 7, 1).value).toBe('0049999');
  await info.attach('performance', {
    body: JSON.stringify({
      bytes: Buffer.byteLength(source),
      rows: rowCount,
      analysisAndRenderMs: duration,
      workbookExportMs: exportDuration,
    }),
    contentType: 'application/json',
  });
  expect(duration).toBeLessThan(3e4);
  const renderedRows = await page.getByRole('grid').getByRole('row').count();
  expect(renderedRows).toBeGreaterThan(1);
  expect(renderedRows).toBeLessThan(100);
});
