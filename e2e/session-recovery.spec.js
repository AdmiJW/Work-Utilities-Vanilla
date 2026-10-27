import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { enterSql, readSql, renameTab } from './helpers/workspace.js';
import { createScreenshot, uploadScreenshots } from './helpers/screenshots.js';

test('failed permanent deletion retains pending SQL and screenshots through a later close and reopen', async ({
  page,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Debug', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open debug case Screenshots and shared filename', exact: true })
    .click();
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
  await renameTab(page, 'Debug · Screenshots and shared filename', 'Recovery session');
  await enterSql(page, 'SELECT pending_after_failed_delete;');
  await uploadScreenshots(page, [await createScreenshot(page, 'new-evidence.png', 320, 180)]);
  await expect(page.locator('.screenshot-card')).toHaveCount(3);
  await page.evaluate(() => {
    const remove = IDBObjectStore.prototype.delete;
    let failed = false;
    IDBObjectStore.prototype.delete = function (...args) {
      if (this.name === 'summaries' && !failed) {
        failed = true;
        throw new DOMException('Deletion denied by test', 'UnknownError');
      }
      return Reflect.apply(remove, this, args);
    };
  });
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Session library', exact: true });
  await library.getByRole('button', { name: 'Delete Recovery session', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete saved sessions?', exact: true })
    .getByRole('button', { name: 'Delete sessions', exact: true })
    .click();
  await expect(page.locator('.main-workspace > .notice.error')).toContainText('Deletion denied');
  await expect(page.locator('.workspace')).toHaveAttribute('aria-busy', 'false');
  await library.getByRole('button', { name: 'Close session library', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.getByRole('button', { name: 'Close Recovery session', exact: true }).click();
  await page.getByRole('button', { name: 'Reopen Recovery session', exact: true }).click();
  expect(await readSql(page, info.outputPath('recovered.sql'))).toBe(
    'SELECT pending_after_failed_delete;',
  );
  await expect(page.locator('.screenshot-card')).toHaveCount(3);
  await expect(page.locator('.screenshot-card strong').last()).toHaveText('new-evidence.png');
});
