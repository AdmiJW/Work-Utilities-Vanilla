import { openApp } from './helpers/application.js';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 600 },
  { width: 1024, height: 480 },
  { width: 960, height: 480 },
]) {
  test(`inspector scrolls on ${viewport.width}x${viewport.height} with expanded source and raw data`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    const inner = JSON.stringify({
      items: Array.from({ length: 100 }, (_, i) => ({ index: i, text: `item ${i}` })),
      long: 'x'.repeat(900),
    });
    const payload = JSON.stringify({ nested: inner, padding: 'y'.repeat(900) });
    const expression = `COALESCE(Payload, '${'long expression '.repeat(18)}')`;
    await openApp(page);
    await page
      .getByRole('button', { name: 'New DER/DPR Output Analyzer session', exact: true })
      .click();
    await page.getByRole('textbox', { name: 'Execution output', exact: true }).fill(
      `SQL Statement Run: --1SELECT CONCAT_WS('|',Id,${expression}) FROM Demo
0001|${payload}`,
    );
    await page.getByRole('button', { name: 'Analyze output', exact: true }).click();
    await page.locator('.ag-cell[col-id="1"]').dblclick();
    const panel = page.getByRole('region', { name: 'Cell inspector', exact: true });
    const raw = panel.getByRole('textbox', { name: 'Raw cell value', exact: true });
    await expect(raw).toHaveValue(payload);
    await raw.evaluate((element) => {
      element.style.height = '230px';
    });
    await expect(raw).toHaveCSS('height', '230px');
    await page.getByRole('button', { name: 'Source output', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Execution output', exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    await panel.evaluate((element) => {
      element.scrollTop = 0;
    });
    await panel.focus();
    await page.keyboard.press('PageDown');
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await panel.evaluate((element) => {
      element.scrollTop = 0;
    });
    await panel.hover({ position: { x: 20, y: 20 } });
    await page.mouse.wheel(0, 500);
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await panel.focus();
    for (let index = 0; index < 6; index++) await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: 'Deep', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: 'Decode', exact: true }).click();
    await panel.getByRole('button', { name: 'Expand items', exact: true }).click();
    const tree = panel.locator('.tree-body');
    await expect
      .poll(() => tree.evaluate((element) => element.clientHeight))
      .toBeGreaterThanOrEqual(180);
    await expect
      .poll(() => tree.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    const bounds = await tree.boundingBox();
    const outer = await panel.boundingBox();
    if (!bounds || !outer) throw new Error('Missing scroll regions');
    const top = Math.max(bounds.y, outer.y);
    const bottom = Math.min(bounds.y + bounds.height, outer.y + outer.height);
    expect(bottom).toBeGreaterThan(top);
    await page.mouse.move(bounds.x + 25, (top + bottom) / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => tree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await panel.getByRole('button', { name: 'Deep', exact: true }).click();
    await panel.getByRole('button', { name: 'Pretty', exact: true }).click();
    const pretty = panel.getByRole('textbox', { name: 'Prettified JSON', exact: true });
    await expect(pretty).toHaveValue(/"nested": \{/);
    await expect
      .poll(() => pretty.evaluate((element) => element.getBoundingClientRect().height))
      .toBeGreaterThanOrEqual(180);
    expect(await pretty.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    expect(await pretty.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await panel.getByRole('button', { name: 'Shallow', exact: true }).click();
    await expect(pretty).toHaveValue(/"nested": "/);
    await expect(raw).toHaveValue(payload);
    await panel.getByRole('button', { name: 'Deep', exact: true }).click();
    await expect(pretty).toHaveValue(/"nested": \{/);
    await panel.focus();
    await page.keyboard.press('End');
    await expect
      .poll(() =>
        panel.evaluate((element) =>
          Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
        ),
      )
      .toBeLessThanOrEqual(1);
    await pretty.focus();
    await page.keyboard.press('Control+End');
    await expect.poll(() => pretty.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({
      path: `artifacts/inspector-${viewport.width}x${viewport.height}-light-${info.project.name}.png`,
    });
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await page.screenshot({
      path: `artifacts/inspector-${viewport.width}x${viewport.height}-dark-${info.project.name}.png`,
    });
    if (viewport.width > 1e3) {
      await page.getByRole('button', { name: 'Source output', exact: true }).click();
      const divider = page.getByRole('separator', { name: 'Resize cell inspector', exact: true });
      await divider.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(divider).toHaveAttribute('aria-valuenow', '380');
    }
    await panel.getByRole('button', { name: 'Close cell inspector', exact: true }).click();
    await expect(panel).toHaveCount(0);
  });
}
