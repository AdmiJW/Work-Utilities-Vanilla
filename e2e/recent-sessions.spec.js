import { openApp, moveWorkspaceToOfflineFile } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { enterSql, readSql } from './helpers/workspace.js';
import { seedSavedSessions } from './helpers/saved-sessions.js';
test('recent homepage limits to eight, orders viewed sessions, restores state and removes deleted history', async ({
  page,
}, info) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'A little less repetitive.' })).toBeVisible();
  const base = Date.UTC(2026, 9, 1);
  const records = Array.from({ length: 10 }, (_, index) => ({
    id: `saved-${index}`,
    name: `Query ${index}`,
    toolId: 'sql-formatter',
    source: index === 0 ? '' : `SELECT '${index}';`,
    createdAt: base,
    updatedAt: base + 1e3 - index * 100,
    ...(index === 3 ? {} : { lastViewedAt: base + 1e3 - index * 100 }),
    options: { wordWrap: true },
  }));
  await seedSavedSessions(page, records);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recent sessions', exact: true })).toBeVisible();
  const rows = page.getByRole('list', { name: 'Recently viewed sessions' }).getByRole('button');
  await expect(rows).toHaveCount(8);
  await expect(page.locator('.recent-session strong')).toHaveText(
    Array.from({ length: 8 }, (_, i) => `Query ${i}`),
  );
  await expect(rows.nth(3)).toContainText('Updated');
  await expect(rows.first()).toContainText('Viewed');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: `artifacts/recents-light-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: `artifacts/recents-dark-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Reopen Query 7', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Query 7', exact: true })).toHaveAttribute(
    'id',
    'tab-saved-7',
  );
  await expect(page.getByRole('button', { name: 'Word Wrap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await readSql(page, info.outputPath('restored.sql'))).toBe("SELECT '7';");
  await enterSql(page, 'SELECT edited;');
  await page.getByRole('button', { name: 'Close Query 7', exact: true }).click();
  await expect(page.locator('.recent-session strong').first()).toHaveText('Query 7');
  await page.reload();
  await expect(page.locator('.recent-session strong').first()).toHaveText('Query 7');
  await page.getByRole('button', { name: 'Session Library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Session library', exact: true });
  await library.getByRole('button', { name: 'Delete Query 7', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete saved sessions?', exact: true })
    .getByRole('button', { name: 'Delete sessions', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Delete saved sessions?', exact: true }),
  ).toBeHidden();
  await library.getByRole('button', { name: 'Close session library', exact: true }).click();
  await expect(rows).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Reopen Query 7', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New SQL Formatter', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'SQL Formatter 21', exact: true })).toBeVisible();
});
test('failed recent reopening stays recoverable and retries without duplicating the session', async ({
  page,
}) => {
  await openApp(page);
  await expect(page.getByRole('heading', { name: 'A little less repetitive.' })).toBeVisible();
  const record = {
    id: 'missing',
    name: 'Recoverable query',
    toolId: 'sql-formatter',
    source: 'SELECT recovered;',
    createdAt: 1,
    missingDocument: true,
  };
  await seedSavedSessions(page, [record]);
  await page.reload();
  const reopen = page.getByRole('button', { name: 'Reopen Recoverable query', exact: true });
  await reopen.click();
  await expect(page.getByRole('alert')).toContainText('saved document could not be found');
  await expect(reopen).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Recent sessions', exact: true })).toBeVisible();
  await expect(reopen).toContainText('Updated');
  await seedSavedSessions(page, [{ ...record, missingDocument: false }]);
  await reopen.click();
  await expect(page.getByRole('tab', { name: 'Recoverable query', exact: true })).toHaveAttribute(
    'id',
    'tab-missing',
  );
  await expect(page.getByRole('tablist', { name: 'Tool sessions' }).getByRole('tab')).toHaveCount(
    1,
  );
});
test('recent sessions reopen offline with analyzer state restored', async ({
  page,
  context,
}, info) => {
  await openApp(page);
  await expect(page.getByText('Offline ready', { exact: true })).toBeVisible({ timeout: 3e4 });
  await seedSavedSessions(page, [
    {
      id: 'offline-analysis',
      name: 'Offline results',
      toolId: 'output-analyzer',
      createdAt: 1,
      source: `SQL Statement Run: --1SELECT CONCAT_WS('|',Id,Payload) FROM Demo
0001|{"value":123}`,
      options: { analyzed: true, inputCollapsed: true, selectedSheet: '1', jsonDecodeMode: 'deep' },
    },
  ]);
  await page.reload();
  if (info.project.metadata.mode === 'hosted') await moveWorkspaceToOfflineFile(page, info);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Reopen Offline results', exact: true }).click();
  await expect(page.getByRole('gridcell', { name: '0001', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled();
  await page.locator('.ag-cell[col-id="1"]').dblclick();
  await expect(page.getByRole('button', { name: 'Deep', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Close Offline results', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Reopen Offline results', exact: true }),
  ).toContainText('Viewed');
});
