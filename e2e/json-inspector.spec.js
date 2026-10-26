import { openApp } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
test('inspector opens explicitly and deep decoding changes inspection without changing raw data or Excel', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const inner = '{"large":9007199254740993123456789,"x":1,"x":2,"text":"box | fragile"}';
  const payload = JSON.stringify({
    outer: JSON.stringify({ inner }),
    array: JSON.stringify(['a', 'b']),
    ordinary: '0001',
  });
  const source = `SQL Statement Run: --1SELECT CONCAT_WS('|',d.Id,d.Payload) FROM Demo d
0001|${payload}`;
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Execution output', exact: true }).fill(source);
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  const cell = page.locator('.ag-cell[col-id="1"]').filter({ hasText: 'outer' });
  await cell.click();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open cell inspector', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue(
    payload,
  );
  await expect(page.getByRole('button', { name: 'Shallow', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Close cell inspector', exact: true }).click();
  await cell.click();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await cell.dblclick();
  await page.getByRole('button', { name: 'Deep', exact: true }).click();
  await page.getByRole('button', { name: 'Pretty', exact: true }).click();
  const pretty = page.getByRole('textbox', { name: 'Prettified JSON', exact: true });
  await expect(pretty).toHaveValue(/"outer": \{\s*"inner": \{/);
  await expect(pretty).toHaveValue(/9007199254740993123456789/);
  expect((await pretty.inputValue()).match(/"x":/g)).toHaveLength(2);
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue(
    payload,
  );
  await page.locator('.ag-cell[col-id="0"]').click();
  await expect(page.getByRole('textbox', { name: 'Raw cell value', exact: true })).toHaveValue(
    '0001',
  );
  await cell.click();
  await expect(pretty).toHaveValue(/9007199254740993123456789/);
  await page.getByRole('button', { name: 'Shallow', exact: true }).click();
  await expect(pretty).toHaveValue(/"outer": "/);
  await page.getByRole('button', { name: 'Tree', exact: true }).click();
  await page
    .locator('.json-tree')
    .filter({ has: page.getByText('outer', { exact: true }) })
    .getByRole('button', { name: 'Decode', exact: true })
    .first()
    .click();
  await expect(page.getByText('Decoded string \xB7 depth 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deep', exact: true }).click();
  await expect(page.getByText('Decoded string \xB7 depth 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pretty', exact: true }).click();
  await expect(pretty).toHaveValue(/"outer": \{/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  const path = info.outputPath('raw.xlsx');
  await (await download).saveAs(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  expect(workbook.worksheets[0].getCell('B7').value).toBe('d.Payload');
  expect(workbook.worksheets[0].getCell('B8').value).toBe(payload);
  await page.getByRole('button', { name: /Raw value/ }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: `artifacts/deep-json-light-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: `artifacts/deep-json-dark-${info.project.name}.png` });
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(cell).toBeVisible();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await cell.dblclick();
  await expect(page.getByRole('button', { name: 'Deep', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(errors).toEqual([]);
});
