import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openApp, moveWorkspaceToOfflineFile } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';
import { createScreenshot, pasteOrDropScreenshot } from './helpers/screenshots.js';

async function markdown(page, source = '') {
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown editor', exact: true })).toBeVisible();
  if (source) {
    await openFile(page, 'Open Markdown', 'note.md', Buffer.from(source));
    await expect
      .poll(() =>
        page
          .getByRole('textbox', { name: 'Markdown editor', exact: true })
          .evaluate(
            (dom, expected) => dom.cmTile.root.view.state.doc.toString() === expected,
            source.replace(/\r\n?/g, '\n'),
          ),
      )
      .toBe(true);
  }
}
async function exported(page, info, name = 'note.md') {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Markdown', exact: true }).click();
  const path = info.outputPath(name);
  await (await pending).saveAs(path);
  return readFile(path, 'utf8');
}

test('live preview, reading and source preserve Markdown while allowing inline edits', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const source =
    '# Heading\r\n\r\nA **bold** paragraph with [link](https://example.com).\r\n\r\n- [ ] task\r\n\r\n```js\r\nconst value = 1;\r\n```\r\n';
  await markdown(page, source);
  await expect(page.locator('.md-heading')).toBeVisible();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(page.locator('.md-strong')).toHaveText('bold');
  await expect(
    page.getByRole('textbox', { name: 'Markdown reading view', exact: true }),
  ).toHaveAttribute('contenteditable', 'false');
  expect(await exported(page, info)).toBe(source);
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Mark task complete', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Mark task incomplete', exact: true }),
  ).toBeChecked();
  expect(await exported(page, info, 'task.md')).toBe(source.replace('- [ ]', '- [x]'));
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('End');
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await input.focus();
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exported(page, info, 'undo.md')).toBe(source.replace('- [ ]', '- [x]'));
  expect(errors).toEqual([]);
});

test('visual table cells retain focus, escape pipes and share undo with structural edits', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const source = 'Before\n\n| Name | Value |\n| :--- | ---: |\n| old | **bold** |\n\nAfter\n';
  await markdown(page, source);
  const table = page.getByRole('table', { name: 'Markdown table', exact: true });
  await expect(table).toBeVisible();
  await table.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await expect(cell).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('new|value');
  await expect(cell).toBeFocused();
  expect(await exported(page, info)).toBe(source.replace('| old |', '| new\\|value |'));
  await cell.focus();
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exported(page, info, 'undo-cell.md')).toBe(source);
  await cell.focus();
  await page.keyboard.press('ControlOrMeta+Y');
  await page.keyboard.press('Tab');
  const second = page.getByRole('textbox', { name: 'Table row 2 column 2', exact: true });
  await expect(second).toBeFocused();
  await page.keyboard.insertText('*changed*');
  await page.keyboard.press('Tab');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(
    page.getByRole('textbox', { name: 'Table row 3 column 1', exact: true }),
  ).toBeFocused();
  await table
    .getByRole('cell', { name: 'Row 3, column 1', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add column', exact: true }).click();
  await expect(table.getByRole('row').first().locator('th')).toHaveCount(3);
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(table.getByRole('row').first().locator('th')).toHaveCount(2);
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const result = await exported(page, info, 'table.md');
  expect(result).toContain('Before\n\n');
  expect(result).toContain('\n\nAfter\n');
  expect(result).toContain('new\\|value');
  expect(result).toContain('*changed*');
  expect(errors).toEqual([]);
});

test('embedded images export original bytes and remote resources never load', async ({
  page,
}, info) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('remote-image.test')) requests.push(request.url());
  });
  await markdown(
    page,
    '![remote](https://remote-image.test/image.png)\n\n<script>alert(1)</script>\n',
  );
  await expect(page.getByText('Image unavailable offline: remote', { exact: true })).toBeVisible();
  const file = await createScreenshot(page, 'local.png');
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (await choosing).setFiles(file);
  await expect(page.locator('.md-image img')).toHaveCount(1);
  const value = await exported(page, info);
  expect(value).toContain(`data:image/png;base64,${file.buffer.toString('base64')}`);
  await page
    .locator('.md-image')
    .filter({ has: page.locator('img') })
    .getByRole('button', { name: 'Alt text', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('Updated image');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Updated image', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('imports, persisted view settings and workspace transfer work offline', async ({
  page,
}, info) => {
  await markdown(page, '# Original\n\ntext\n');
  await openFile(page, 'Open Markdown', 'next.markdown', Buffer.from('inserted'));
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await exported(page, info)).toBe('# Original\n\ntext\n');
  await openFile(
    page,
    'Open Markdown',
    'next.txt',
    Buffer.from('# Replaced\n\n| a | b |\n| --- | --- |\n| x | y |\n'),
  );
  await page.getByRole('button', { name: 'Replace all', exact: true }).click();
  await page.getByRole('button', { name: 'Wide', exact: true }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await moveWorkspaceToOfflineFile(page, info);
  await expect(page.getByRole('button', { name: 'Reading', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Wide', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('table', { name: 'Markdown table', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 960, height: 600 });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: info.outputPath('markdown-dark.png') });
  expect(await exported(page, info, 'offline.md')).toContain('# Replaced');
});

test('cell typing preserves spaces, composition and inline image previews', async ({
  page,
}, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await markdown(page, '| A | B |\n| --- | --- |\n| old | second |\n');
  const table = page.getByRole('table', { name: 'Markdown table', exact: true });
  await table.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  let cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('two words');
  await expect(cell).toHaveText('two words');
  await cell.dispatchEvent('compositionstart');
  await page.keyboard.insertText('中文');
  await cell.dispatchEvent('compositionend');
  await expect(cell).toHaveText('two words中文');
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  const image = await createScreenshot(page, 'cell.png', 80, 40);
  await pasteOrDropScreenshot(page, image, 'paste', cell);
  await expect(table.getByRole('img', { name: 'cell', exact: true })).toHaveCount(1);
  await table.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await expect(cell.getByRole('img', { name: 'cell', exact: true })).toHaveCount(1);
  expect(await cell.innerText()).not.toContain('base64');
  const source = await exported(page, info);
  expect(source).toContain(image.buffer.toString('base64'));
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(table.getByRole('img', { name: 'cell', exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('image paste/drop is undoable and invalid images leave Markdown untouched', async ({
  page,
}, info) => {
  await markdown(page, 'Start\n');
  const input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  const file = await createScreenshot(page, 'paste.png');
  await pasteOrDropScreenshot(page, file, 'paste', input);
  await expect(page.locator('.md-image img')).toHaveCount(1);
  await input.focus();
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exported(page, info)).toBe('Start\n');
  await pasteOrDropScreenshot(page, file, 'drop', page.locator('.markdown-host'));
  await expect(page.locator('.md-image img')).toHaveCount(1);
  const before = await exported(page, info, 'before.md');
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (
    await choosing
  ).setFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('valid PNG or JPEG');
  expect(await exported(page, info, 'after.md')).toBe(before);
});

test('formatting, find/replace and session reload retain document state', async ({
  page,
}, info) => {
  await markdown(page, 'hello world\n');
  const input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await input.focus();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowRight');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  expect(await exported(page, info)).toContain('**hello**');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  const search = page.getByRole('textbox', { name: 'Find', exact: true });
  await search.fill('world');
  await page.getByRole('button', { name: 'Toggle Replace', exact: true }).click();
  await page.getByRole('textbox', { name: 'Replace', exact: true }).fill('work');
  await page.getByRole('button', { name: 'Replace All', exact: true }).click();
  await page.getByRole('button', { name: 'Close Find', exact: true }).click();
  await page.getByRole('button', { name: 'Wide', exact: true }).click();
  const before = await exported(page, info, 'before.md');
  expect(before).toContain('work');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Wide', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await exported(page, info, 'after.md')).toBe(before);
});

test('image-heavy documents stay editable and import limits fail without changes', async ({
  page,
}, info) => {
  await markdown(page);
  const original = await createScreenshot(page, 'large.png', 80, 40);
  const file = {
    ...original,
    buffer: Buffer.concat([
      original.buffer,
      Buffer.alloc(4 * 1024 * 1024 - original.buffer.length),
    ]),
  };
  let choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (await choosing).setFiles(file);
  await expect(page.locator('.md-image img')).toHaveCount(1);
  const input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n\nAfter image');
  expect(await exported(page, info)).toContain('After image');
  const before = await exported(page, info, 'before.md');
  choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add image', exact: true }).click();
  await (
    await choosing
  ).setFiles({ ...file, name: 'too-large.png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('5 MiB');
  expect(await exported(page, info, 'after.md')).toBe(before);
  await openFile(page, 'Open Markdown', 'too-big.md', Buffer.alloc(20 * 1024 * 1024 + 1, 97));
  await expect(page.getByRole('alert')).toContainText('20 MiB');
  expect(await exported(page, info, 'after-document-limit.md')).toBe(before);
});

test('table search, inline rendering and formatting undo work together', async ({ page }, info) => {
  await markdown(
    page,
    'https://example.com\n\n| A | B |\n| --- | --- |\n| # **cell** | needle |\n\n[named][r]\n\n[r]: https://first.example\n[r]: https://second.example\n',
  );
  const table = page.getByRole('table', { name: 'Markdown table', exact: true });
  await expect(table.locator('td strong')).toHaveText('cell');
  await table.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('alpha beta');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+B');
  expect(await exported(page, info)).toContain('**alpha beta**');
  await cell.focus();
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await exported(page, info, 'undo-format.md')).toContain('| alpha beta |');
  await cell.focus();
  await page.keyboard.press('ControlOrMeta+F');
  await page.getByRole('textbox', { name: 'Find', exact: true }).fill('needle');
  await page.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(table.locator('.md-selected-cell')).toHaveText('needle');
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(page.locator('.md-link[data-url="https://example.com"]')).toBeVisible();
  await expect(page.locator('.md-link[data-url="https://first.example"]')).toHaveText('named');
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Replace', exact: true })).toHaveCount(0);
});

test('delayed image insertion follows edits and cancels after closing its session', async ({
  page,
}, info) => {
  await markdown(page, 'Start\n');
  const file = await createScreenshot(page, 'delayed.png', 80, 40);
  const hold = () =>
    page.evaluate(() => {
      const decode = window.createImageBitmap;
      window.__resumeMarkdownImage = null;
      window.createImageBitmap = async (...args) => {
        window.createImageBitmap = decode;
        await new Promise((resolve) => (window.__resumeMarkdownImage = resolve));
        return decode(...args);
      };
    });
  let input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await input.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await hold();
  await pasteOrDropScreenshot(page, file, 'paste', input);
  await expect
    .poll(() => page.evaluate(() => typeof window.__resumeMarkdownImage))
    .toBe('function');
  await input.focus();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.insertText('Prefix ');
  await page.evaluate(() => window.__resumeMarkdownImage());
  await expect(page.locator('.md-image img')).toHaveCount(1);
  const before = await exported(page, info);
  expect(before).toMatch(/^Prefix Start\n!\[delayed\]/);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  input = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
  await hold();
  await pasteOrDropScreenshot(page, file, 'paste', input);
  await expect
    .poll(() => page.evaluate(() => typeof window.__resumeMarkdownImage))
    .toBe('function');
  await page.getByRole('button', { name: 'Close Markdown Editor 02', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Markdown Editor 02', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__resumeMarkdownImage());
  expect(await exported(page, info, 'after.md')).toBe(before);
});

test('a fresh downloaded app creates and exports Markdown with no network access', async ({
  page,
  browser,
}, info) => {
  await markdown(page, '# Private Markdown fixture 758391');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download offline app', exact: true }).click();
  const path = info.outputPath('fresh-markdown.html');
  await (await pending).saveAs(path);
  expect(await readFile(path, 'utf8')).not.toContain('Private Markdown fixture 758391');
  const context = await browser.newContext({ offline: true, acceptDownloads: true });
  try {
    const offline = await context.newPage(),
      requests = [];
    offline.on('request', (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await offline.goto(pathToFileURL(path).href);
    await offline.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
    const input = offline.getByRole('textbox', { name: 'Markdown editor', exact: true });
    await input.focus();
    await offline.keyboard.insertText('# Offline\n\n| A | B |\n| --- | --- |\n| x | y |\n');
    await expect(offline.getByRole('table', { name: 'Markdown table', exact: true })).toBeVisible();
    await offline.getByRole('button', { name: 'Reading', exact: true }).click();
    expect(await exported(offline, info, 'fresh.md')).toContain('# Offline');
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});
