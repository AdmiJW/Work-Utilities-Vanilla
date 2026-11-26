import { expect, test } from '@playwright/test';
import { openApp, startSession } from './helpers/application.js';

test.use({ viewport: { width: 768, height: 600 }, hasTouch: true });

test('tablet navigation and action menus preserve workspace focus and tab state', async ({
  page,
}) => {
  await openApp(page);
  const navigation = page.getByRole('button', { name: 'Open workspace navigation' });
  const drawer = page.getByRole('dialog', { name: 'Workspace navigation' });
  await navigation.tap();
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeFocused();
  await startSession(page, 'SQL Formatter');
  await startSession(page, 'Markdown Editor');
  const actions = page.getByRole('button', { name: 'Tab actions' });
  await actions.tap();
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).tap();
  await page.getByRole('textbox', { name: 'Session name', exact: true }).fill('Tablet notes');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Tablet notes' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await navigation.tap();
  await page.setViewportSize({ width: 1024, height: 480 });
  await expect(drawer).toHaveCount(0);
  const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
  await expect(collapse).toBeFocused();
  await collapse.click();
  await page.setViewportSize({ width: 1023, height: 480 });
  await expect(navigation).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 480 });
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.setViewportSize({ width: 768, height: 600 });
  await actions.tap();
  await page.getByRole('menuitem', { name: 'Close All', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Recent sessions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reopen Tablet notes' })).toBeVisible();
});

test('all three tools expose their main actions at tablet width', async ({ page }) => {
  await openApp(page);
  const tab = (name) => page.getByRole('tab', { name, exact: true });
  const button = (name) => page.getByRole('button', { name, exact: true });
  await startSession(page, 'SQL Formatter');
  const sql = page.getByRole('textbox', { name: 'SQL editor' });
  await sql.fill('SELECT\n  1;');
  await button('SQL actions').tap();
  await page.getByRole('menuitem', { name: 'One-line' }).tap();
  await expect(sql).toHaveText('SELECT 1;');
  const unit = button('Unit Test (0)');
  await unit.tap();
  const unitPanel = page.getByRole('region', { name: 'Unit Test screenshots' });
  await expect(unitPanel).toHaveClass(/overlay-side-panel/);
  await unitPanel.getByRole('button', { name: 'Close Unit Test panel' }).tap();
  await expect(unit).toBeFocused();
  const sqlDownload = page.waitForEvent('download');
  await button('Export SQL').tap();
  expect((await sqlDownload).suggestedFilename()).toMatch(/\.sql$/);

  await startSession(page, 'DER/DPR Output Analyzer');
  await page
    .getByRole('textbox', { name: 'Execution output' })
    .fill('SQL Statement Run: --1SELECT Id FROM Demo\n0001');
  await button('Analyze output').tap();
  const cell = page.getByRole('gridcell', { name: '0001', exact: true });
  await cell.tap();
  const inspector = button('Open cell inspector');
  await inspector.tap();
  await expect(page.getByRole('region', { name: 'Cell inspector' })).toBeFocused();
  await button('Close cell inspector').tap();
  await expect(inspector).toBeFocused();
  await button('Sheet actions').tap();
  await page.getByRole('menuitem', { name: 'Rename result sheet' }).tap();
  await page.getByRole('textbox', { name: 'Result sheet name' }).fill('Tablet results');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: /^Tablet results/ })).toBeFocused();
  const excelDownload = page.waitForEvent('download');
  await button('Export Excel').tap();
  expect((await excelDownload).suggestedFilename()).toMatch(/\.xlsx$/);

  await startSession(page, 'Markdown Editor');
  const markdown = page.getByRole('textbox', { name: 'Markdown editor' });
  const markdownFile = page.waitForEvent('filechooser');
  await button('Markdown actions').tap();
  await page.getByRole('menuitem', { name: 'Open Markdown' }).tap();
  await (
    await markdownFile
  ).setFiles({
    name: 'tablet.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Tablet layout'),
  });
  await expect(markdown).toContainText('Tablet layout');
  await button('View').tap();
  await page.getByRole('menuitemcheckbox', { name: 'Line numbers' }).tap();
  await button('View').tap();
  await page.getByRole('menuitem', { name: 'Find', exact: true }).tap();
  await expect(page.locator('.md-find-widget')).toBeVisible();
  await page.keyboard.press('Escape');
  const markdownDownload = page.waitForEvent('download');
  await button('Markdown actions').tap();
  await page.getByRole('menuitem', { name: 'Export Markdown', exact: true }).tap();
  expect((await markdownDownload).suggestedFilename()).toMatch(/\.md$/);
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.save-status')).toHaveText('All changes saved');
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
    editor: document.querySelector('.markdown-host').clientHeight,
  }));
  expect(sizes.scroll).toBe(sizes.width);
  expect(sizes.editor).toBeGreaterThan(300);
  await tab('SQL Formatter 01').tap();
  await expect(sql).toHaveText('SELECT 1;');
});
