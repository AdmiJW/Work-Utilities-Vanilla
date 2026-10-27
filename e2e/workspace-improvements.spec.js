import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { enterSql, openFile, renameTab } from './helpers/workspace.js';

test('tab names, filenames and import adoption are independent; inline edits and menus work with keyboard', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  const filename = page.getByRole('textbox', { name: 'Export filename', exact: true });
  await renameTab(page, 'SQL Formatter 01', 'Investigation 27 Oct');
  await expect(filename).toHaveValue('SQL Formatter 01');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openFile(page, 'Open SQL', 'first.sql', Buffer.from('SELECT 1;'));
  await expect(filename).toHaveValue('first');
  await openFile(page, 'Open SQL', 'inserted.sql', Buffer.from('SELECT 2;'));
  await page.getByRole('button', { name: 'Insert at cursor', exact: true }).click();
  await expect(filename).toHaveValue('first');
  await openFile(page, 'Open SQL', 'replacement.sql', Buffer.from('SELECT 3;'));
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(filename).toHaveValue('replacement');
  await filename.fill('PT-C-DER112233-01.sql');
  await filename.press('Enter');
  await expect(filename).toHaveValue('PT-C-DER112233-01');
  await openFile(page, 'Open SQL', 'different.sql', Buffer.from('SELECT 4;'));
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await expect(filename).toHaveValue('PT-C-DER112233-01');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('PT-C-DER112233-01.sql');
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  const first = page.getByRole('tab', { name: 'Investigation 27 Oct', exact: true });
  await first.dblclick();
  await page.getByRole('textbox', { name: 'Session name', exact: true }).fill('Cancelled');
  await page.keyboard.press('Escape');
  await expect(first).toBeVisible();
  await first.focus();
  await page.keyboard.press('F2');
  const input = page.getByRole('textbox', { name: 'Session name', exact: true });
  await input.fill('Renamed inline');
  await input.press('Tab');
  const renamed = page.getByRole('tab', { name: 'Renamed inline', exact: true });
  await renamed.focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: 'Tab actions', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Rename', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(renamed).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close Renamed inline', exact: true }).click();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await page.getByRole('button', { name: 'Reopen Renamed inline', exact: true }).click();
  await expect(filename).toHaveValue('PT-C-DER112233-01');
});

test('Debug embeds all examples, creates prepared independent sessions, and compatibility contains status chips only', async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, 'SELECT existing_session;');
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  const debug = page.getByRole('dialog', { name: 'Debug cases', exact: true });
  await expect(debug.locator('.debug-case')).toHaveCount(5);
  await debug
    .getByRole('button', { name: 'Open debug case Screenshots and shared filename', exact: true })
    .click();
  await expect(debug).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Export filename', exact: true })).toHaveValue(
    'PT-C-DER000001-01',
  );
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
  await page.getByRole('tab', { name: 'SQL Formatter 01', exact: true }).click();
  await expect(page.locator('.cm-content:visible')).toContainText('existing_session');
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  await debug.getByRole('button', { name: 'Output Analyzer', exact: true }).click();
  await expect(debug.locator('.debug-case')).toHaveCount(12);
  await debug
    .getByRole('button', {
      name: 'Open debug case Ordinary SELECT and wildcard fallback',
      exact: true,
    })
    .click();
  await expect(page.getByRole('tablist', { name: 'Result sheets', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Browser compatibility', exact: true }).click();
  const compatibility = page.getByRole('dialog', { name: 'Browser compatibility', exact: true });
  await expect(compatibility.locator('.status-chip.available')).toHaveCount(2);
  await expect(compatibility.locator('dt')).toHaveText(['Application', 'Autosave', 'Background']);
  await expect(
    compatibility.getByRole('button', { name: 'Test a download', exact: true }),
  ).toHaveCount(0);
  await expect(compatibility).not.toContainText('Third-party licenses');
  expect(await page.locator('#third-party-licenses').textContent()).toContain('exceljs');
});
