import { openApp } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import { enterSql, renameTab, readSql } from './helpers/workspace.js';
test('horizontal tab dragging persists order and context menus archive the correct sessions', async ({
  page,
}, info) => {
  test.setTimeout(9e4);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page);
  await expect(page).toHaveTitle('Work Utilities Vanilla');
  for (let index = 1; index <= 4; index++) {
    await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
    await renameTab(
      page,
      `SQL Formatter 0${index}`,
      ['First', 'Second', 'Third', 'Fourth'][index - 1],
    );
  }
  await enterSql(page, "SELECT 'save before close';");
  await expect(page.locator('.breadcrumb')).toContainText('Fourth');
  await expect(page.getByRole('textbox', { name: 'Export filename', exact: true })).toHaveValue(
    'SQL Formatter 04',
  );
  await expect(
    page.getByRole('button', { name: 'New session of current tool', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Stored in your browser', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Browser-only processing', { exact: true })).toHaveCount(0);
  const tabs = page.getByRole('tablist', { name: 'Tool sessions' });
  const third = await tabs.getByRole('tab', { name: 'Third', exact: true }).boundingBox();
  const first = await tabs.getByRole('tab', { name: 'First', exact: true }).boundingBox();
  if (!third || !first) throw new Error('Missing drag targets');
  await page.mouse.move(third.x + 35, third.y + 15);
  await page.mouse.down();
  await page.mouse.move(third.x + 20, third.y + 15, { steps: 3 });
  await expect(page.locator('.tab-drag-preview')).toBeVisible();
  const initial = await page.locator('.tab-drag-preview').boundingBox();
  await page.mouse.move(first.x + 10, third.y + 115, { steps: 15 });
  const moved = await page.locator('.tab-drag-preview').boundingBox();
  expect(Math.abs(moved.y - initial.y)).toBeLessThan(2);
  await page.mouse.up();
  await expect(tabs.getByRole('tab')).toHaveText(['Third', 'First', 'Second', 'Fourth']);
  await expect(tabs.getByRole('tab', { name: 'Fourth', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(tabs.getByRole('tab')).toHaveText(['Third', 'First', 'Second', 'Fourth']);
  await tabs.getByRole('tab', { name: 'First', exact: true }).click({ button: 'right' });
  await expect(
    page.getByRole('menuitem', { name: 'Close to the Right', exact: true }),
  ).toBeVisible();
  await page.getByRole('menuitem', { name: 'Close to the Right', exact: true }).click();
  await expect(tabs.getByRole('tab')).toHaveText(['Third', 'First']);
  await expect(tabs.getByRole('tab', { name: 'First', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await tabs.getByRole('tab', { name: 'First', exact: true }).focus();
  await page.keyboard.press('Shift+F10');
  await expect(
    page.getByRole('menuitem', { name: 'Close to the Right', exact: true }),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Session name', exact: true }).fill('Renamed query');
  await page.getByRole('textbox', { name: 'Session name', exact: true }).press('Enter');
  await expect(page.locator('.breadcrumb')).toContainText('Renamed query');
  await tabs.getByRole('tab', { name: 'Third', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Close', exact: true }).click();
  await expect(tabs.getByRole('tab')).toHaveText(['Renamed query']);
  await tabs.getByRole('tab', { name: 'Renamed query', exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Close All', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recent sessions', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Session library', exact: true });
  const fourth = library.locator('.saved-session').filter({ hasText: 'Fourth' });
  await fourth.getByRole('button', { name: 'Reopen Fourth', exact: true }).click();
  expect(await readSql(page, info.outputPath('archived.sql'))).toBe("SELECT 'save before close';");
  await page.setViewportSize({ width: 1e3, height: 720 });
  for (let index = 0; index < 7; index++)
    await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('.session-tabs')
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    )
    .toBe(true);
  expect(
    await page
      .locator('.session-tabs')
      .evaluate((element) => element.scrollHeight - element.clientHeight),
  ).toBeLessThanOrEqual(1);
});
test('Session Library sorts, filters selection and permanently deletes selected open/closed sessions', async ({
  page,
}, info) => {
  await openApp(page);
  for (const [index, name] of ['Zed', 'Alpha', 'Alpine'].entries()) {
    await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
    await renameTab(page, `SQL Formatter 0${index + 1}`, name);
  }
  await page.getByRole('button', { name: 'Close Alpha', exact: true }).click();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Session library', exact: true });
  await expect(library.getByRole('combobox', { name: 'Appearance' })).toHaveCount(0);
  await library.getByRole('button', { name: 'Name', exact: true }).click();
  await expect(library.locator('.saved-details strong')).toHaveText(['Alpha', 'Alpine', 'Zed']);
  await expect(
    library
      .locator('.saved-session')
      .filter({ hasText: 'Alpha' })
      .getByText('Closed', { exact: true }),
  ).toBeVisible();
  await expect(
    library
      .locator('.saved-session')
      .filter({ hasText: 'Alpine' })
      .getByText('Open', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/session-library-light-${info.project.name}.png`,
    animations: 'disabled',
  });
  await library.getByRole('button', { name: 'Close session library', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await expect(library).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.screenshot({
    path: `artifacts/session-library-dark-${info.project.name}.png`,
    animations: 'disabled',
  });
  await library.getByRole('button', { name: 'Close session library', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await library.getByRole('button', { name: 'Date', exact: true }).click();
  await expect(library.locator('.saved-details strong')).toHaveText(['Alpine', 'Alpha', 'Zed']);
  await library.getByRole('button', { name: 'Name', exact: true }).click();
  const search = library.getByRole('searchbox', { name: 'Find a saved session', exact: true });
  await search.fill('Al');
  await library.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await expect(
    library.getByRole('button', { name: 'Delete selected (2)', exact: true }),
  ).toBeEnabled();
  await search.fill('Zed');
  await expect(
    library.getByRole('button', { name: 'Delete selected (0)', exact: true }),
  ).toBeDisabled();
  await search.fill('Al');
  await library.getByRole('checkbox', { name: 'Select Alpha', exact: true }).check();
  await expect(library.getByRole('checkbox', { name: 'Select all', exact: true })).toBeChecked({
    indeterminate: true,
  });
  await library.getByRole('checkbox', { name: 'Select all', exact: true }).check();
  await library.getByRole('button', { name: 'Delete selected (2)', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete saved sessions?', exact: true });
  await expect(confirm).toContainText('1 open tab(s) will also close.');
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(library.locator('.saved-session')).toHaveCount(2);
  await library.getByRole('button', { name: 'Delete selected (2)', exact: true }).click();
  await confirm.getByRole('button', { name: 'Delete sessions', exact: true }).click();
  await expect(library.getByText('No matching sessions.', { exact: true })).toBeVisible();
  await search.fill('');
  await expect(library.locator('.saved-details strong')).toHaveText(['Zed']);
  await expect(confirm).toBeHidden();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await library.getByRole('button', { name: 'Close session library', exact: true }).click();
  await expect(page.getByRole('tablist', { name: 'Tool sessions' }).getByRole('tab')).toHaveText([
    'Zed',
  ]);
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open session library', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Name', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(library.locator('.saved-details strong')).toHaveText(['Zed']);
});
