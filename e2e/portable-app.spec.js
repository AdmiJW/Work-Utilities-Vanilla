import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import { openApp, openLocalFile } from './helpers/application.js';
import { enterSql, readSql, openFile } from './helpers/workspace.js';

test('downloaded application contains no session data and both tools work offline in a fresh browser context', async ({
  page,
  browser,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  const privateMarker = 'SELECT portable_workspace_secret_653279;';
  await enterSql(page, privateMarker);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download offline app', exact: true }).click();
  const path = info.outputPath('downloaded-application.html');
  await (await downloading).saveAs(path);
  const html = await readFile(path, 'utf8');
  expect(html).not.toContain(privateMarker);
  expect(html).not.toMatch(/<script[^>]+src=/i);
  expect(html).toContain('id="third-party-licenses"');
  const context = await browser.newContext({ offline: true });
  const local = await context.newPage();
  const requests = [];
  local.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  try {
    await local.goto(pathToFileURL(path).href);
    await expect(local.getByRole('heading', { name: 'A little less repetitive.' })).toBeVisible();
    await local.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
    await enterSql(local, 'SELECT\n  0001 AS Id;');
    await local.getByRole('button', { name: 'One-line', exact: true }).click();
    expect(await readSql(local, info.outputPath('offline.sql'))).toBe('SELECT 0001 AS Id;');
    await local
      .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
      .click();
    const raw = '{"number":9007199254740993123456789,"number":2,"text":"box | fragile"}';
    await local
      .getByRole('textbox', { name: 'Execution output', exact: true })
      .fill(`SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM Demo\n0001|${raw}`);
    await local.getByRole('button', { name: 'Analyze output', exact: true }).click();
    await local.locator('.ag-cell[col-id="1"]').dblclick();
    await local.getByRole('button', { name: 'Pretty', exact: true }).click();
    await expect(local.getByRole('textbox', { name: 'Prettified JSON' })).toHaveValue(
      /9007199254740993123456789/,
    );
    const excel = local.waitForEvent('download');
    await local.getByRole('button', { name: 'Export Excel', exact: true }).click();
    const workbookPath = info.outputPath('offline.xlsx');
    await (await excel).saveAs(workbookPath);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    expect(workbook.worksheets[0].getCell('A8').value).toBe('0001');
    expect(workbook.worksheets[0].getCell('B8').value).toBe(raw);
    await local.getByRole('button', { name: 'Browser compatibility', exact: true }).click();
    const compatibility = local.getByRole('dialog', { name: 'Browser compatibility', exact: true });
    await expect(compatibility.locator('.status-chip')).toHaveCount(2);
    await expect(compatibility).not.toContainText('Third-party licenses');
    expect(await local.locator('#third-party-licenses').textContent()).toContain(
      'ag-grid-community',
    );
    expect(await local.locator('#third-party-licenses').textContent()).toContain('@codemirror');
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test('workspace backup restores exact sessions and preferences, with confirmation and invalid-file protection', async ({
  page,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await openFile(page, 'Open SQL', 'exact.sql', Buffer.from("SELECT '0001';\r\n"));
  await page.getByRole('button', { name: 'Word Wrap', exact: true }).click();
  await page.getByRole('button', { name: 'Close SQL Formatter 01', exact: true }).click();
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Execution output', exact: true })
    .fill('SQL Statement Run: --1SELECT CONCAT_WS(\'|\',Id,Payload) FROM Demo\n0001|{"x":1}');
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await page.locator('.ag-cell[col-id="1"]').dblclick();
  await page.getByRole('button', { name: 'Deep', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const path = info.outputPath('workspace.json');
  await (await downloading).saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(backup.summaries).toHaveLength(2);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, 'SELECT discard_after_restore;');
  await openLocalFile(page, 'Import workspace', path);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SQL Formatter 02', exact: true })).toBeVisible();
  await openLocalFile(page, 'Import workspace', path);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Tool sessions' }).getByRole('tab')).toHaveText([
    'Output Analyzer 01',
  ]);
  await expect(page.locator('html')).toHaveClass('dark');
  await page.locator('.ag-cell[col-id="1"]').dblclick();
  await expect(page.getByRole('button', { name: 'Deep', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Close cell inspector', exact: true }).click();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await page.getByRole('button', { name: 'Reopen SQL Formatter 01', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Word Wrap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await readSql(page, info.outputPath('restored.sql'))).toBe("SELECT '0001';\r\n");
  await openFile(
    page,
    'Import workspace',
    'bad.json',
    Buffer.from('{"format":"work-utilities-workspace","schemaVersion":99}'),
  );
  await expect(page.getByRole('alert')).toContainText('not a supported');
  expect(await readSql(page, info.outputPath('after-invalid.sql'))).toBe("SELECT '0001';\r\n");
});

test('blocked workers use foreground processing and blocked clipboard opens selectable raw text', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw new DOMException('Workers blocked', 'SecurityError');
      }
    };
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Clipboard blocked', 'NotAllowedError')),
      },
    });
  });
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  const raw = '{"number":12345678901234567890}';
  await page
    .getByRole('textbox', { name: 'Execution output', exact: true })
    .fill(`SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM Demo\n0001|${raw}`);
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByText(/Background processing is unavailable/)).toBeVisible();
  await page.locator('.ag-cell[col-id="1"]').dblclick();
  await page.getByRole('button', { name: 'Pretty', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Prettified JSON' })).toHaveValue(
    /12345678901234567890/,
  );
  await page.getByRole('button', { name: 'Copy raw value', exact: true }).click();
  const copy = page.getByRole('dialog', { name: 'Copy text', exact: true });
  await expect(copy.getByRole('textbox', { name: 'Text to copy' })).toHaveValue(raw);
  expect(
    await copy.getByRole('textbox').evaluate((input) => input.selectionEnd - input.selectionStart),
  ).toBe(raw.length);
  await copy.getByRole('button', { name: 'Done', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
  await (await downloading).saveAs(info.outputPath('foreground.xlsx'));
  await page.getByRole('button', { name: 'Browser compatibility', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Browser compatibility', exact: true }),
  ).toContainText('foreground');
});

test('storage denial keeps the application usable and permits backup recovery after reloading', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await openApp(page);
  await expect(page.getByText('Memory only', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, 'SELECT recover_memory_only;');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const path = info.outputPath('memory-backup.json');
  await (await downloading).saveAs(path);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A little less repetitive.' })).toBeVisible();
  await openLocalFile(page, 'Import workspace', path);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  expect(await readSql(page, info.outputPath('recovered.sql'))).toBe('SELECT recover_memory_only;');
  await expect(page.getByText('Memory only', { exact: true })).toBeVisible();
});

test('replacing the HTML at the same local path retains the saved workspace', async ({
  browser,
}, info) => {
  const original = await readFile('dist/work-utilities.html', 'utf8');
  const path = info.outputPath('updatable-app.html');
  await writeFile(path, original);
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(path).href);
    await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
    await enterSql(page, 'SELECT retain_after_update;');
    const tabId = await page
      .getByRole('tab', { name: 'SQL Formatter 01', exact: true })
      .getAttribute('id');
    const backup = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
    await (await backup).saveAs(info.outputPath('before-update.json'));
    await writeFile(
      path,
      original.replace(
        '<title>Work Utilities Vanilla</title>',
        '<title>Work Utilities Vanilla Update Test</title>',
      ),
    );
    await page.reload();
    await expect(page).toHaveTitle('Work Utilities Vanilla Update Test');
    await expect(page.getByRole('tab', { name: 'SQL Formatter 01', exact: true })).toHaveAttribute(
      'id',
      tabId,
    );
    expect(await readSql(page, info.outputPath('after-update.sql'))).toBe(
      'SELECT retain_after_update;',
    );
  } finally {
    await context.close();
  }
});

test('a worker that never starts falls back instead of leaving analysis stuck', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      terminate() {}
      postMessage() {}
    };
  });
  await openApp(page);
  await page
    .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Execution output', exact: true })
    .fill("SQL Statement Run: --1SELECT CONCAT_WS('|',Id,State) FROM Demo\n0001|ACTIVE");
  await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: '0001', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/Background processing is unavailable/)).toBeVisible();
});
