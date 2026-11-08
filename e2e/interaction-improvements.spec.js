import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';

async function openMarkdown(page, source) {
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await openFile(page, 'Open Markdown', 'navigation.md', Buffer.from(source));
  await expect(page.getByRole('textbox', { name: 'Markdown editor', exact: true })).toBeVisible();
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
const outer = (page) => page.locator('.markdown-host > .cm-editor');
async function caret(page, position) {
  await outer(page).evaluate((dom, pos) => {
    const view = dom.querySelector('.cm-content').cmTile.root.view;
    view.dispatch({ selection: { anchor: pos } });
    view.focus();
  }, position);
}
async function textPoint(locator, needle, offset) {
  return locator.evaluate(
    (node, { needle, offset }) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode()))
        if (text.textContent.includes(needle)) {
          const p = text.textContent.indexOf(needle) + offset,
            range = document.createRange();
          range.setStart(text, p);
          range.setEnd(text, p + 1);
          const box = range.getBoundingClientRect();
          return { x: box.left + 0.3, y: (box.top + box.bottom) / 2 };
        }
      throw new Error('Text not found');
    },
    { needle, offset },
  );
}
async function source(page) {
  return outer(page).evaluate((dom) =>
    dom.querySelector('.cm-content').cmTile.root.view.state.doc.toString(),
  );
}

test('rendered Markdown arrows, clicks and drag selections follow visible text', async ({
  page,
}) => {
  const content =
    '# Heading\n\nalpha paragraph\n\n## Subheading\n\nbeta paragraph\n\n---\n\ngamma paragraph\n\n```js\nconst n=1;\n```\n\nlast paragraph';
  await openMarkdown(page, content);
  await caret(page, content.length);
  const lines = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('ArrowUp');
    lines.push(
      await outer(page).evaluate((dom) => {
        const v = dom.querySelector('.cm-content').cmTile.root.view;
        return v.state.doc.lineAt(v.state.selection.main.head).number;
      }),
    );
  }
  expect(lines[0]).toBeGreaterThan(1);
  expect(lines).toContain(3);
  expect(lines).toContain(7);
  expect(lines).toContain(11);
  const alpha = page.locator('.markdown-host .cm-line').filter({ hasText: 'alpha paragraph' });
  let point = await textPoint(alpha, 'alpha', 4);
  await page.mouse.click(point.x, point.y);
  expect(
    await outer(page).evaluate(
      (dom) => dom.querySelector('.cm-content').cmTile.root.view.state.selection.main.head,
    ),
  ).toBe(content.indexOf('alpha') + 4);
  const begin = await textPoint(alpha, 'alpha', 1),
    end = await textPoint(
      page.locator('.markdown-host .cm-line').filter({ hasText: 'gamma paragraph' }),
      'gamma',
      4,
    );
  await page.mouse.move(begin.x, begin.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  const range = await outer(page).evaluate((dom) => {
    const r = dom.querySelector('.cm-content').cmTile.root.view.state.selection.main;
    return { from: r.from, to: r.to };
  });
  expect(range).toEqual({ from: content.indexOf('alpha') + 1, to: content.indexOf('gamma') + 4 });
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  point = await textPoint(alpha, 'alpha', 2);
  await page.mouse.click(point.x, point.y);
  expect(await source(page)).toBe(content);
});

test('table arrows and ragged-cell entry are source-neutral and editing materializes only that cell', async ({
  page,
}) => {
  const content =
    'Before text\n\n| A | B |\n| --- | ---: |\n| alpha | beta |\n| ragged |\n\nAfter text';
  await openMarkdown(page, content);
  await caret(page, 'Before text'.length);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('textbox', { name: 'Table row 1 column 1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  const virtual = page.getByRole('textbox', { name: 'Table row 3 column 2', exact: true });
  await expect(virtual).toBeFocused();
  expect(await source(page)).toBe(content);
  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByRole('textbox', { name: 'Table row 2 column 2', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(virtual).toBeFocused();
  expect(await source(page)).toBe(content);
  await page.keyboard.insertText('filled');
  expect(await source(page)).toBe(content.replace('| ragged |', '| ragged | filled |'));
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await source(page)).toBe(content);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('textbox', { name: 'Markdown editor', exact: true })).toBeFocused();
  expect(await source(page)).toBe(content);
});

test('clicks on formatted cells map to source characters instead of selecting all', async ({
  page,
}) => {
  await openMarkdown(
    page,
    '| A | B |\n| --- | --- |\n| **bold** &amp; [link](https://example.com) | x |',
  );
  const td = page.getByRole('cell', { name: 'Row 2, column 1', exact: true });
  const point = await textPoint(td.locator('strong'), 'bold', 2);
  await page.mouse.click(point.x, point.y);
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await expect(cell).toBeFocused();
  await page.keyboard.insertText('X');
  expect(await source(page)).toContain('**boXld**');
});

test('Find toggles, preserves query, supports replacement and keeps editor geometry stable', async ({
  page,
}, info) => {
  await openMarkdown(page, '# Search\n\nalpha ALPHA alphabet alpha\n');
  const before = await page
    .locator('.markdown-host .cm-line')
    .filter({ hasText: 'alpha ALPHA' })
    .boundingBox();
  const trigger = page.getByRole('button', { name: 'Find', exact: true });
  await trigger.click();
  const input = page.getByRole('textbox', { name: 'Find', exact: true });
  await input.fill('alpha');
  await expect(page.locator('.md-find-count')).toHaveText('4 matches');
  await page.getByRole('button', { name: 'Match case', exact: true }).click();
  await page.getByRole('button', { name: 'Whole word', exact: true }).click();
  await expect(page.locator('.md-find-count')).toHaveText('2 matches');
  await trigger.click();
  await expect(input).toHaveCount(0);
  await trigger.click();
  await expect(input).toHaveValue('alpha');
  const after = await page
    .locator('.markdown-host .cm-line')
    .filter({ hasText: 'alpha ALPHA' })
    .boundingBox();
  expect(after.y).toBeCloseTo(before.y, 1);
  expect(after.width).toBeCloseTo(before.width, 1);
  await page.getByRole('button', { name: 'Toggle Replace', exact: true }).click();
  await page.getByRole('textbox', { name: 'Replace', exact: true }).fill('done');
  await page.getByRole('button', { name: 'Replace All', exact: true }).click();
  expect(await source(page)).toContain('done ALPHA alphabet done');
  await page.getByRole('button', { name: 'Close Find', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Markdown editor', exact: true })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await source(page)).toContain('alpha ALPHA alphabet alpha');
  await trigger.click();
  await page.screenshot({ path: info.outputPath('find-widget.png') });
});

test('Ctrl+S commits filename drafts and immediately saves every tool without downloads', async ({
  page,
}) => {
  await openApp(page);
  const downloads = [];
  page.on('download', (item) => downloads.push(item.suggestedFilename()));
  for (const [name, label, text] of [
    ['SQL Formatter', 'SQL editor', 'SELECT saved;'],
    ['DER/DPR Output Analyzer', 'Execution output', 'saved output'],
    ['Markdown Editor', 'Markdown editor', '# Saved note'],
  ]) {
    await page.getByRole('button', { name: `New ${name} session`, exact: true }).click();
    const input = page.getByRole('textbox', { name: label, exact: true });
    await input.focus();
    await page.keyboard.insertText(text);
    const filename = page.getByRole('textbox', { name: 'Export filename', exact: true });
    await filename.fill('Saved draft');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(filename).toBeFocused();
    await expect(page.locator('.manual-save-feedback')).toContainText('Saved');
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Export filename', exact: true })).toHaveValue(
      'Saved draft',
    );
    if (label === 'Execution output')
      await expect(page.getByRole('textbox', { name: label, exact: true })).toHaveValue(text);
    else
      await expect(page.getByRole('textbox', { name: label, exact: true })).toContainText(
        text.replace('# ', ''),
      );
  }
  expect(downloads).toEqual([]);
});

test('saving an inactive tab rename preserves focus, commits its baseline, and persists both sessions', async ({
  page,
}) => {
  await openMarkdown(page, '# First draft');
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  const sql = page.getByRole('textbox', { name: 'SQL editor', exact: true });
  await sql.focus();
  await page.keyboard.insertText('SELECT active_draft;');
  const tab = page.getByRole('tab', { name: 'Markdown Editor 01', exact: true });
  await tab.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  const draft = page.getByRole('textbox', { name: 'Session name', exact: true });
  await draft.fill('Renamed inactive note');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(draft).toBeFocused();
  await expect(draft).toHaveValue('Renamed inactive note');
  await expect(page.locator('.manual-save-feedback')).toContainText('Renamed inactive note');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Renamed inactive note', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'SQL editor', exact: true })).toContainText(
    'active_draft',
  );
  await page.getByRole('tab', { name: 'Renamed inactive note', exact: true }).click();
  expect(await source(page)).toBe('# First draft');
});

test('wrapped cell arrows traverse visual lines before rows and enter at the visible line end', async ({
  page,
}) => {
  const long = 'Wrapped words for navigation. '.repeat(18);
  const content = `Before\n\n| A | B |\n| --- | --- |\n| ${long} | one |\n| X | two |\n| ${long} | three |\n\nAfter`;
  await openMarkdown(page, content);
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await cell.evaluate((dom) => {
    const v = dom.cmTile.root.view;
    v.dispatch({ selection: { anchor: 10 } });
    v.focus();
  });
  await page.keyboard.press('ArrowDown');
  await expect(cell).toBeFocused();
  expect(
    await cell.evaluate((dom) => dom.cmTile.root.view.state.selection.main.head),
  ).toBeGreaterThan(10);
  await cell.evaluate((dom) => {
    const v = dom.cmTile.root.view,
      edge = v.coordsAtPos(v.state.doc.length, -1),
      x = v.contentDOM.getBoundingClientRect().left + 160;
    const p = v.posAndSideAtCoords({ x, y: (edge.top + edge.bottom) / 2 }, false);
    v.dispatch({ selection: { anchor: p.pos } });
  });
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('textbox', { name: 'Table row 3 column 1', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const last = page.getByRole('textbox', { name: 'Table row 4 column 1', exact: true });
  await expect(last).toBeFocused();
  expect(
    await last.evaluate((dom) => dom.cmTile.root.view.state.selection.main.head),
  ).toBeGreaterThan(5);
  await page.keyboard.press('Shift+ArrowDown');
  await expect(last).toBeFocused();
  expect(await source(page)).toBe(content);
});

test('Find supports keyboard seeding, regex feedback, capped counts and Reading mode', async ({
  page,
}, info) => {
  await openMarkdown(page, 'selected needle\n\n' + 'alpha '.repeat(1100));
  await outer(page).evaluate((dom) => {
    const v = dom.querySelector('.cm-content').cmTile.root.view;
    v.dispatch({ selection: { anchor: 0, head: 8 } });
    v.focus();
  });
  await page.keyboard.press('ControlOrMeta+f');
  const field = page.getByRole('textbox', { name: 'Find', exact: true });
  await expect(field).toHaveValue('selected');
  await field.fill('alpha');
  await expect(page.locator('.md-find-count')).toHaveText('1,000+ matches');
  await page.getByRole('button', { name: 'Use regular expression', exact: true }).click();
  await field.fill('(');
  await expect(page.locator('.md-find-count')).toHaveText('Invalid regex');
  await expect(page.getByRole('button', { name: 'Next match', exact: true })).toBeDisabled();
  await field.fill('needle');
  await page.keyboard.press('ControlOrMeta+h');
  await expect(page.getByRole('textbox', { name: 'Replace', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(field).toHaveValue('needle');
  await expect(page.getByRole('textbox', { name: 'Replace', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 760, height: 560 });
  const box = await page.locator('.md-find-widget').boundingBox();
  expect(box.x).toBeGreaterThan(0);
  expect(box.x + box.width).toBeLessThanOrEqual(760);
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.screenshot({ path: info.outputPath('find-dark.png') });
});

test('Markdown Debug embeds all six offline examples and opens each without changing previous sessions', async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('offline-image.invalid')) requests.push(r.url());
  });
  await openApp(page);
  for (let index = 0; index < 6; index++) {
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Debug cases', exact: true });
    await dialog.getByRole('button', { name: 'Markdown Editor', exact: true }).click();
    await expect(dialog.locator('.debug-case')).toHaveCount(6);
    await expect(
      dialog.getByRole('button', { name: 'Markdown Editor', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await dialog.locator('.debug-case').nth(index).click();
    await expect(page.locator('dialog')).toHaveCount(0);
    const initial = await source(page);
    expect(initial.length).toBeGreaterThan(400);
    await page.getByRole('button', { name: 'Reading', exact: true }).click();
    expect(await source(page)).toBe(initial);
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    expect(await source(page)).toBe(initial);
    await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  }
  await expect(
    page.getByRole('tablist', { name: 'Tool sessions', exact: true }).getByRole('tab'),
  ).toHaveCount(6);
  expect(await page.evaluate(() => window.thisMustNeverExecute)).toBeUndefined();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const reducedMotion of ['no-preference', 'reduce'])
  test(`dialogs, panels and tool transitions preserve focus with ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await openApp(page);
    const animations = await page.evaluate(() => {
      const trigger = document.querySelector('.header-status button:last-child');
      trigger.focus();
      trigger.click();
      const dialog = document.querySelector('dialog');
      window.dialogCloseCount = 0;
      dialog.addEventListener('close', () => window.dialogCloseCount++);
      return dialog
        .getAnimations()
        .filter((a) => !(a instanceof CSSAnimation))
        .map((a) => a.effect.getTiming().duration);
    });
    if (reducedMotion === 'reduce') expect(animations).toEqual([]);
    else expect(animations).toContain(160);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.dialogCloseCount)).toBe(1);
    await expect(page.getByRole('button', { name: 'Debug', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'SQL editor', exact: true });
    await input.focus();
    await page.keyboard.insertText('SELECT retained;');
    const unit = page.getByRole('button', { name: /^Unit Test \(/ });
    for (let i = 0; i < 2; i++) {
      await unit.click();
      await expect(unit).toHaveAttribute('aria-expanded', 'true');
      await unit.click();
      await expect(unit).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.locator('.motion-panel-ghost')).toHaveCount(0);
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
    await expect(input).toContainText('retained');
    await page.getByRole('button', { name: 'Open session library', exact: true }).click();
    const library = page.getByRole('dialog', { name: 'Session library', exact: true });
    await library.getByRole('button', { name: 'Delete SQL Formatter 01', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Delete saved sessions?', exact: true })
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(page.locator('dialog')).toHaveCount(1);
    await expect(
      library.getByRole('button', { name: 'Delete SQL Formatter 01', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).toHaveCount(0);
  });

test('manual save reports memory-only storage and defers metadata saving through composition', async ({
  page,
}) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await openMarkdown(page, '# Memory draft');
  const filename = page.getByRole('textbox', { name: 'Export filename', exact: true });
  await filename.fill('Composed name');
  await filename.dispatchEvent('compositionstart');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.manual-save-feedback')).toBeHidden();
  await filename.dispatchEvent('compositionend');
  await expect(page.locator('.manual-save-feedback')).toContainText('Memory only');
  await expect(filename).toBeFocused();
  await expect(filename).toHaveValue('Composed name');
  await expect(page.getByText('Memory only', { exact: true })).toBeVisible();
  await filename.fill('');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(filename).toHaveAttribute('aria-invalid', 'true');
  await expect(filename).toHaveValue('');
});
