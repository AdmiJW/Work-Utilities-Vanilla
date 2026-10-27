import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { enterSql, readSql } from './helpers/workspace.js';

test('SQL selections stay visible at endpoints, one-line adds blank separators, and nested file dragging has a visible overlay', async ({
  page,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await enterSql(page, "SELECT 'first; value';\nSELECT 'middle';\nSELECT 'last';");
  for (const dark of [false, true]) {
    if (dark) await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    for (const reverse of [false, true]) {
      await page.locator('.cm-content').focus();
      await page.keyboard.press(reverse ? 'Control+End' : 'Control+Home');
      await page.keyboard.press(reverse ? 'Control+Shift+Home' : 'Control+Shift+End');
      await expect(page.locator('.cm-selectionBackground')).not.toHaveCount(0);
      const style = await page.locator('.cm-activeLine').evaluate((line) => {
        const color = getComputedStyle(line).backgroundColor;
        return {
          color,
          transparent: color.includes('/')
            ? Number(color.split('/')[1].replace(')', '')) < 1
            : color.startsWith('rgba') && Number(color.split(',').at(-1).replace(')', '')) < 1,
        };
      });
      expect(style.transparent).toBe(true);
      await expect(page.locator('.cm-activeLine')).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
      );
      const selected = await page
        .locator('.cm-selectionBackground')
        .first()
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(selected).not.toBe('rgb(34, 51, 51)');
      await page.screenshot({ path: info.outputPath(`selection-${dark}-${reverse}.png`) });
    }
  }
  await page.getByRole('button', { name: 'One-line', exact: true }).click();
  expect(await readSql(page, info.outputPath('blank-separated.sql'))).toBe(
    "SELECT 'first; value';\n\nSELECT 'middle';\n\nSELECT 'last';",
  );
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['SELECT 8;'], 'dropped.sql', { type: 'text/plain' }));
    return data;
  });
  const host = page.locator('.sql-editor');
  const content = host.locator('.cm-content');
  try {
    await host.dispatchEvent('dragenter', { dataTransfer: transfer });
    await content.dispatchEvent('dragenter', { dataTransfer: transfer });
    await content.dispatchEvent('dragleave', { dataTransfer: transfer });
    await expect(host).toHaveClass(/file-drag-over/);
    expect(
      await host.evaluate((element) => getComputedStyle(element, '::after').content),
    ).toContain('Drop a SQL file');
    await content.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(host).not.toHaveClass(/file-drag-over/);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  } finally {
    await transfer.dispose();
  }
});
