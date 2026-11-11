import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';

const input = (page) => page.locator('.markdown-host > .cm-editor > .cm-scroller > .cm-content');
const text = (page) => input(page).evaluate((dom) => dom.cmTile.root.view.state.doc.toString());
async function select(locator, anchor, head = anchor) {
  await locator.evaluate(
    (dom, { anchor, head }) => {
      const view = dom.cmTile.root.view;
      view.dispatch({ selection: { anchor, head } });
      view.focus();
    },
    { anchor, head },
  );
}
async function markdown(page, source) {
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await openFile(page, 'Open Markdown', 'phase.md', Buffer.from(source));
  await expect(input(page)).toBeVisible();
}
test('table menus target clicked cells, columns fit content and Tab selects without changing arrow navigation', async ({
  page,
}, info) => {
  const source =
    '| ID | Description |\n| --- | --- |\n| 1 | A considerably longer description with several words |\n| 2 | replace me |\n\nAfter\n\n| X | Y |\n| --- | --- |\n| a | b |';
  await markdown(page, source);
  const table = page.getByRole('table', { name: 'Markdown table', exact: true }).first();
  expect(await page.locator('.md-table-tools').count()).toBe(0);
  const widths = await table
    .locator('th')
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
  expect(widths[1]).toBeGreaterThan(widths[0] * 1.5);
  const short = page.getByRole('table', { name: 'Markdown table', exact: true }).last();
  expect((await short.boundingBox()).width).toBeLessThan(400);
  await table.getByRole('cell', { name: 'Row 3, column 1', exact: true }).click();
  await page.keyboard.press('Tab');
  const cell = page.getByRole('textbox', { name: 'Table row 3 column 2', exact: true });
  expect(
    await cell.evaluate((dom) => {
      const v = dom.cmTile.root.view;
      return v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to);
    }),
  ).toBe('replace me');
  await page.keyboard.press('ArrowLeft');
  expect(await cell.evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(0);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  expect(await cell.evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(10);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.insertText('new');
  expect(await text(page)).toContain('| 2 | new |');
  await table
    .getByRole('columnheader', { name: 'Row 1, column 1', exact: true })
    .click({ button: 'right' });
  await expect(page.getByRole('menu', { name: 'Table actions' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Align right', exact: true }).click();
  expect(
    await table
      .locator('th')
      .first()
      .evaluate((cell) => getComputedStyle(cell).textAlign),
  ).toBe('right');
  await table.getByRole('cell', { name: 'Row 2, column 2', exact: true }).click();
  await page.keyboard.press('Shift+F10');
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('textbox', { name: 'Table row 2 column 2', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 900, height: 640 });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  const many = Array.from({ length: 12 }, (_, i) => `C${i + 1}`);
  const wide =
    '| ' +
    many.join(' | ') +
    ' |\n| ' +
    many.map(() => '---').join(' | ') +
    ' |\n| ' +
    many.map(() => 'x').join(' | ') +
    ' |';
  await input(page).evaluate(
    (dom, source) => {
      const view = dom.cmTile.root.view;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: source },
        selection: { anchor: 0 },
      });
    },
    '| A | B |\n| --- | --- |\n| 1 | https://example.test/' +
      'lengthy'.repeat(100) +
      ' |\n\n' +
      wide,
  );
  const geometry = await input(page).evaluate((dom) => {
    const css = getComputedStyle(dom),
      tables = dom.querySelectorAll('table'),
      scroll = dom.querySelectorAll('.md-table-scroll');
    return {
      limit:
        dom.getBoundingClientRect().width -
        parseFloat(css.paddingLeft) -
        parseFloat(css.paddingRight),
      width: tables[0].getBoundingClientRect().width,
      overflow: scroll[1].scrollWidth - scroll[1].clientWidth,
      pageOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.width).toBeLessThanOrEqual(geometry.limit + 1);
  expect(geometry.overflow).toBeGreaterThan(100);
  expect(geometry.pageOverflow).toBe(0);
  await page.screenshot({ path: info.outputPath('tables-narrow-dark.png') });
});

test('paragraph entry immediately below a table stays outside it and is undoable', async ({
  page,
}) => {
  const source = '| A | B |\n| --- | --- |\n| x | y |\n';
  await markdown(page, source);
  await select(input(page), source.length);
  await page.keyboard.insertText('Paragraph');
  expect(await text(page)).toBe(source + '\nParagraph');
  await expect(page.getByRole('table', { name: 'Markdown table' }).getByRole('row')).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(source);
  await page.getByRole('cell', { name: 'Row 2, column 2', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.insertText('Next');
  expect(await text(page)).toBe(source + '\nNext');
});

test('inline formatting toggles the enclosing span then its word, and markers reveal only at that span', async ({
  page,
}) => {
  const source = '**Apple juice** and **other** words\n\n| A |\n| --- |\n| **cell value** |';
  await markdown(page, source);
  await select(input(page), 4);
  await expect(page.locator('.markdown-host > .cm-editor .md-strong').first()).toHaveText(
    '**Apple juice**',
  );
  await expect(page.locator('.markdown-host > .cm-editor .md-strong').nth(1)).toHaveText('other');
  await page.keyboard.press('ControlOrMeta+B');
  expect(await text(page)).toContain('Apple juice and **other**');
  await page.keyboard.press('ControlOrMeta+B');
  expect(await text(page)).toContain('**Apple** juice and **other**');
  await select(input(page), 10);
  await expect(page.locator('.markdown-host > .cm-editor .md-strong').first()).toHaveText('Apple');
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await select(cell, 4);
  await page.keyboard.press('ControlOrMeta+B');
  expect(await text(page)).toContain('| cell value |');
  await page.keyboard.press('ControlOrMeta+B');
  expect(await text(page)).toContain('| **cell** value |');
  await select(cell, 10);
  await expect(cell.locator('.md-strong')).toHaveText('cell');
});

test('HTML renders isolated static roots, blocks direct entry, deletes roots atomically and preserves source on undo', async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('html-remote.test')) requests.push(request.url());
  });
  const first =
    '<div style="color: red; position: fixed; background-image: url(https://html-remote.test/bg)"><p>Nested <b>text</b></p><img src="https://html-remote.test/a.png" alt="remote"><script>window.__htmlExecuted = true</script></div>';
  const source = first + '<span style="font-weight:700">Sibling</span>\n\nAfter';
  await markdown(page, source);
  const units = page.locator('.markdown-host > .cm-editor .md-html-unit');
  await expect(units).toHaveCount(2);
  await expect(units.first().locator('b')).toHaveText('text');
  expect(
    await units
      .first()
      .locator('div')
      .evaluate((dom) => dom.style.position),
  ).toBe('');
  expect(
    await units
      .first()
      .locator('div')
      .evaluate((dom) => dom.style.color),
  ).toBe('red');
  await expect(units.first().locator('script')).toHaveCount(0);
  await expect(units.first().locator('.offline-image')).toContainText('unavailable offline');
  expect(await page.evaluate(() => window.__htmlExecuted)).toBeUndefined();
  expect(requests).toEqual([]);
  await select(input(page), first.length);
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe(source.slice(first.length));
  await expect(units).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(source);
  await select(input(page), source.length);
  await page.keyboard.insertText('<strong>blocked</strong>');
  expect(await text(page)).toBe(source);
  await expect(page.locator('.md-edit-status')).toContainText('Switch to Source');
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  await select(input(page), source.length);
  await page.keyboard.insertText('\n\n<strong>allowed</strong>');
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await expect(units).toHaveCount(3);
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  expect(errors).toEqual([]);
});

test('view toggles persist per document, outline excludes HTML/code headings and all modes scroll past the end', async ({
  page,
}, info) => {
  const source =
    '# First\n\n## Second\n\n<div><h1>HTML heading</h1></div>\n\n```cs\npublic class Example { string Name = "value"; }\n```\n\n```bash\nif true; then echo "$HOME"; fi\n```\n\n```md\n# Code heading\n```\n\nLast';
  await markdown(page, source);
  await expect(page.getByRole('button', { name: 'Line numbers', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.markdown-host > .cm-editor .cm-lineNumbers')).toBeVisible();
  await expect(page.locator('.md-outline')).toBeHidden();
  await page.getByRole('button', { name: 'Table of contents', exact: true }).click();
  await expect(page.locator('.md-outline-list button')).toHaveText(['First', 'Second']);
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  const outline = await page.locator('.md-outline').boundingBox(),
    find = await page.locator('.md-find-widget').boundingBox();
  expect(outline.y).toBeGreaterThanOrEqual(find.y + find.height);
  await page.getByRole('button', { name: 'Close Find', exact: true }).click();
  await page
    .locator('.md-outline-list')
    .getByRole('button', { name: 'Second', exact: true })
    .click();
  expect(await input(page).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(
    source.indexOf('## Second'),
  );
  for (const mode of ['Live Preview', 'Source', 'Reading']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    const padding = await input(page).evaluate((dom) => {
      const css = getComputedStyle(dom);
      return { bottom: parseFloat(css.paddingBottom), line: parseFloat(css.lineHeight) };
    });
    expect(padding.bottom).toBeGreaterThanOrEqual(padding.line * 19.9);
    expect(await text(page)).toBe(source);
  }
  await expect(page.locator('.markdown-host > .cm-editor .cm-lineNumbers')).toHaveCount(0);
  const code = page.locator('.md-code-line').filter({ hasText: 'public class' });
  expect(await code.locator('span[class]').count()).toBeGreaterThan(0);
  const bash = page.locator('.md-code-line').filter({ hasText: 'if true;' });
  expect(await bash.locator('span[class]').count()).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Line numbers', exact: true }).click();
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.save-status')).toHaveText('All changes saved');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Line numbers', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.locator('.md-outline')).toBeVisible();
  await page.screenshot({ path: info.outputPath('markdown-outline.png') });
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Line numbers', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.md-outline')).toBeHidden();
});

test('inline HTML in table cells stays atomic through line-break projections and malformed HTML stays literal', async ({
  page,
}) => {
  const source =
    '| A | B |\n| --- | --- |\n| <span>one<br>two</span> | <div>literal block</div> |\n\n<div>unclosed';
  await markdown(page, source);
  const table = page.getByRole('table', { name: 'Markdown table' });
  await expect(table.locator('.md-html-unit')).toHaveCount(1);
  await table.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await expect(cell.locator('.md-html-unit')).toHaveCount(1);
  await expect(cell.locator('.md-html-unit').locator('span').first()).toHaveText('onetwo');
  await select(cell, 0, 2);
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe(source.replace('<span>one<br>two</span>', ''));
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(source);
  await page.keyboard.press('Escape');
  await expect(input(page)).toContainText('<div>unclosed');
});
