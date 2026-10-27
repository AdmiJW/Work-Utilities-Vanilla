import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import { openApp, openLocalFile } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';
import {
  createScreenshot,
  uploadScreenshots,
  pasteOrDropScreenshot,
} from './helpers/screenshots.js';

async function exportUnitTest(page, path, expectedName) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Unit Test', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(expectedName);
  await download.saveAs(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return workbook;
}

test('native Ctrl+V pastes an image into the focused Unit Test panel', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await page.getByRole('button', { name: 'Unit Test (0)', exact: true }).click();
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  });
  await page.getByRole('region', { name: 'Unit Test screenshots', exact: true }).focus();
  await page.keyboard.press('Control+V');
  await expect(page.locator('.screenshot-card')).toHaveCount(1);
  await expect(page.locator('.screenshot-description')).toContainText('320 × 180 px');
});

test('screenshot upload, paste, drop, ordering, preview, shared naming and saved image recovery', async ({
  page,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Unit Test screenshots', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Unit Test (0)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export Unit Test', exact: true })).toBeDisabled();
  const png = await createScreenshot(page, 'first.png', 800, 320);
  const jpeg = await createScreenshot(page, 'second.jpg', 600, 240, 'image/jpeg');
  const third = await createScreenshot(page, 'third.png', 480, 200);
  await uploadScreenshots(page, [png]);
  await expect(page.locator('.screenshot-card')).toHaveCount(1);
  await pasteOrDropScreenshot(page, jpeg, 'paste');
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
  await pasteOrDropScreenshot(page, third, 'drop');
  await expect(page.locator('.screenshot-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Preview screenshot 1', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Screenshot preview', exact: true }).getByRole('img'),
  ).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button', { name: 'Close screenshot preview', exact: true }).click();
  await page.getByRole('button', { name: 'Move screenshot 2 up', exact: true }).click();
  await expect(page.locator('.screenshot-card strong')).toHaveText([
    'second.jpg',
    'first.png',
    'third.png',
  ]);
  await page.getByRole('button', { name: 'Remove screenshot 3', exact: true }).click();
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
  const filename = page.getByRole('textbox', { name: 'Export filename', exact: true });
  await filename.fill('PT-C-DER112233-01');
  await filename.press('Enter');
  await openFile(page, 'Open SQL', 'replacement.sql', Buffer.from('SELECT 9;'));
  await expect(filename).toHaveValue('PT-C-DER112233-01');
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
  const workbook = await exportUnitTest(
    page,
    info.outputPath('images.xlsx'),
    'UT-PT-C-DER112233-01.xlsx',
  );
  expect(workbook.worksheets).toHaveLength(1);
  expect(workbook.worksheets[0].rowCount).toBe(0);
  const media = workbook.worksheets[0].getImages();
  expect(media.map((image) => image.range.ext)).toEqual([
    { width: 600, height: 240 },
    { width: 800, height: 320 },
  ]);
  expect(Buffer.from(workbook.getImage(media[0].imageId).buffer)).toEqual(jpeg.buffer);
  expect(Buffer.from(workbook.getImage(media[1].imageId).buffer)).toEqual(png.buffer);
  await filename.fill('CON');
  await filename.press('Enter');
  const reservedSql = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  expect((await reservedSql).suggestedFilename()).toBe('_CON.sql');
  await exportUnitTest(page, info.outputPath('reserved-name.xlsx'), 'UT-_CON.xlsx');
  await filename.fill('PT-C-DER112233-01');
  await filename.press('Enter');
  await page.getByRole('button', { name: 'Close SQL Formatter 01', exact: true }).click();
  await page.getByRole('button', { name: 'Reopen SQL Formatter 01', exact: true }).click();
  await expect(page.locator('.screenshot-card strong')).toHaveText(['second.jpg', 'first.png']);
  await page.reload();
  await expect(page.locator('.screenshot-card strong')).toHaveText(['second.jpg', 'first.png']);
  await expect(filename).toHaveValue('PT-C-DER112233-01');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add images', exact: true }).click();
  await (
    await chooser
  ).setFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(
    page.getByRole('region', { name: 'Unit Test screenshots', exact: true }).getByRole('alert'),
  ).toContainText('valid PNG or JPEG');
  await expect(page.locator('.screenshot-card')).toHaveCount(2);
});

test('screenshot backups transfer to a clean offline HTML file without embedding user images into the application', async ({
  page,
  browser,
}, info) => {
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await page.getByRole('button', { name: 'Unit Test (0)', exact: true }).click();
  const image = await createScreenshot(page, 'private-evidence.png', 713, 237);
  await uploadScreenshots(page, [image]);
  await expect(page.locator('.screenshot-card')).toHaveCount(1);
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const backupPath = info.outputPath('image-backup.json');
  await (await backupDownload).saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.schemaVersion).toBe(2);
  expect(backup.images).toHaveLength(1);
  expect(Buffer.from(backup.images[0].data, 'base64')).toEqual(image.buffer);
  const invalid = structuredClone(backup);
  invalid.images[0].data = image.buffer.subarray(0, 24).toString('base64');
  invalid.documents[0].source = 'SELECT should_never_replace;';
  const invalidPath = info.outputPath('undecodable-image.json');
  await writeFile(invalidPath, JSON.stringify(invalid));
  await openLocalFile(page, 'Import workspace', invalidPath);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be decoded');
  await expect(page.locator('.cm-content')).not.toContainText('should_never_replace');
  await expect(page.locator('.screenshot-card strong')).toHaveText(['private-evidence.png']);
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  const appDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download offline app', exact: true }).click();
  const htmlPath = info.outputPath('image-offline-app.html');
  await (await appDownload).saveAs(htmlPath);
  const html = await readFile(htmlPath, 'utf8');
  expect(html).not.toContain('private-evidence.png');
  expect(html).not.toContain(backup.images[0].data);
  const context = await browser.newContext({ offline: true });
  try {
    const local = await context.newPage();
    const requests = [];
    local.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await local.goto(pathToFileURL(htmlPath).href);
    await openLocalFile(local, 'Import workspace', backupPath);
    await local.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await expect(local.locator('.screenshot-card strong')).toHaveText(['private-evidence.png']);
    const workbook = await exportUnitTest(
      local,
      info.outputPath('offline-unit-test.xlsx'),
      'UT-SQL Formatter 01.xlsx',
    );
    expect(
      Buffer.from(workbook.getImage(workbook.worksheets[0].getImages()[0].imageId).buffer),
    ).toEqual(image.buffer);
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test('screenshot export and recovery work with storage and workers blocked; panel resizes and scrolls on laptop layouts', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage denied', 'SecurityError');
    };
    window.Worker = class {
      constructor() {
        throw new DOMException('Workers denied', 'SecurityError');
      }
    };
  });
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await page.getByRole('button', { name: 'Unit Test (0)', exact: true }).click();
  const images = await Promise.all(
    [1, 2, 3].map((index) => createScreenshot(page, `image-${index}.png`)),
  );
  await uploadScreenshots(page, images);
  await expect(page.locator('.screenshot-card')).toHaveCount(3);
  const separator = page.getByRole('separator', { name: 'Resize Unit Test panel', exact: true });
  await separator.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', '380');
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 600 },
    { width: 1024, height: 480 },
    { width: 960, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    const panel = page.getByRole('region', { name: 'Unit Test screenshots', exact: true });
    await expect(panel).toBeVisible();
    await panel.focus();
    await expect(panel).toBeFocused();
    await expect
      .poll(() => panel.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(0);
    await page.keyboard.press('Control+End');
    await expect
      .poll(() =>
        panel.evaluate((element) =>
          Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
        ),
      )
      .toBeLessThanOrEqual(1);
    await panel.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: info.outputPath('unit-test-narrow-dark.png') });
  const workbook = await exportUnitTest(
    page,
    info.outputPath('foreground-images.xlsx'),
    'UT-SQL Formatter 01.xlsx',
  );
  expect(workbook.worksheets[0].getImages()).toHaveLength(3);
  await expect(page.getByText(/Background processing is unavailable/)).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const path = info.outputPath('memory-images.json');
  await (await downloading).saveAs(path);
  await page.reload();
  await openLocalFile(page, 'Import workspace', path);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.locator('.screenshot-card')).toHaveCount(3);
  await expect(page.getByText('Memory only', { exact: true })).toBeVisible();
});
