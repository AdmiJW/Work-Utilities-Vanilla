import { openApp } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
async function enterSql(page, value) {
  const editor = page.locator('.cm-editor:visible').first();
  await expect(editor).toBeVisible();
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
}
async function exportSql(page, destination) {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  await (await downloaded).saveAs(destination);
  return readFile(destination, 'utf8');
}
test('workspace themes, independent SQL tabs, undo, autosave, and reopen', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'A little less repetitive.' })).toBeVisible();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: join('artifacts', `welcome-light-${info.project.name}.png`) });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.screenshot({ path: join('artifacts', `welcome-dark-${info.project.name}.png`) });
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  const first =
    "-- keep while editing\nSELECT 'first; -- value' AS Result, Id FROM Customer WHERE Id = 1";
  await enterSql(page, first);
  await page.getByRole('tab', { name: 'SQL Formatter 01', exact: true }).dblclick();
  await page.getByRole('textbox', { name: 'Session name' }).fill('First query');
  await page.getByRole('textbox', { name: 'Session name' }).press('Enter');
  await page.getByRole('button', { name: 'One-line', exact: true }).click();
  expect(await exportSql(page, info.outputPath('compact.sql'))).toBe(
    "SELECT 'first; -- value' AS Result, Id FROM Customer WHERE Id = 1;",
  );
  await page.locator('.cm-editor:visible').click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exportSql(page, info.outputPath('undo.sql'))).toBe(first);
  await page.getByRole('button', { name: 'Prettify', exact: true }).click();
  const pretty = await exportSql(page, info.outputPath('pretty.sql'));
  expect(pretty).toContain('-- keep while editing');
  expect(pretty).toContain("'first; -- value'");
  expect(pretty).toMatch(/\nFROM/);
  await page.locator('.cm-editor:visible').click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exportSql(page, info.outputPath('pretty-undo.sql'))).toBe(first);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, "SELECT 'second';");
  await page.getByRole('tab', { name: 'First query', exact: true }).click();
  expect(await exportSql(page, info.outputPath('first.sql'))).toBe(first);
  await page.getByRole('tab', { name: 'SQL Formatter 02', exact: true }).click();
  expect(await exportSql(page, info.outputPath('second.sql'))).toBe("SELECT 'second';");
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'SQL Formatter 02', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'First query', exact: true }).click();
  expect(await exportSql(page, info.outputPath('restored.sql'))).toBe(first);
  await page.getByRole('button', { name: 'Close First query', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'First query', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Session library', exact: true })
    .getByRole('button', { name: 'Reopen First query', exact: true })
    .click();
  expect(await exportSql(page, info.outputPath('reopened.sql'))).toBe(first);
  expect(errors).toEqual([]);
});
test('a second window waits for the editing lock', async ({ page, context }) => {
  await openApp(page);
  await expect(
    page.getByRole('button', { name: 'New SQL Formatter session', exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await openApp(other, false);
  await expect(
    other.getByRole('heading', { name: 'Your workspace is open in another window' }),
  ).toBeVisible();
  await page.close();
  await other.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(
    other.getByRole('button', { name: 'New SQL Formatter session', exact: true }),
  ).toBeVisible();
});
