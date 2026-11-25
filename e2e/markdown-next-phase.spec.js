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
  await expect.poll(() => text(page)).toBe(source);
}

test('typing backtick wraps only plain highlighted text in editable modes and cells', async ({
  page,
}) => {
  const source =
    '# plain text\n\nbefore **bold**\n\n| A | B |\n| --- | --- |\n| first<br>second | other |';
  await markdown(page, source);
  const outer = input(page);
  for (const mode of ['Live Preview', 'Source']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await select(outer, 12, 2);
    await page.keyboard.press('`');
    await expect.poll(() => text(page)).toBe(source.replace('plain text', '`plain text`'));
    expect(
      await outer.evaluate((dom) => {
        const state = dom.cmTile.root.view.state;
        return [state.selection.main.anchor, state.selection.main.head];
      }),
    ).toEqual([13, 3]);
    await page.keyboard.press('ControlOrMeta+Z');
    await expect.poll(() => text(page)).toBe(source);
  }
  const bold = source.indexOf('bold');
  await select(outer, bold, bold + 4);
  await page.keyboard.press('`');
  await expect.poll(() => text(page)).toBe(source.replace('bold', '`'));
  await page.keyboard.press('ControlOrMeta+Z');
  await select(outer, source.indexOf('before') + 2);
  await page.keyboard.press('`');
  await expect.poll(() => text(page)).toBe(source.replace('before', 'be`fore'));
  await page.keyboard.press('ControlOrMeta+Z');

  await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await select(cell, 6, 12);
  await page.keyboard.press('`');
  const wrapped = source.replace('second', '`second`');
  await expect.poll(() => text(page)).toBe(wrapped);
  await expect(cell).toBeFocused();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(() => text(page)).toBe(source);
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect.poll(() => text(page)).toBe(wrapped);
});

test('table edits scroll only when needed and the table has no extra vertical padding', async ({
  page,
}) => {
  const preceding = Array.from({ length: 24 }, (_, i) => `Before ${i}`).join('\n\n');
  const following = Array.from({ length: 35 }, (_, i) => `After ${i}`).join('\n\n');
  const tall = Array.from({ length: 26 }, (_, i) => `line ${i}`).join('<br>');
  const headerLine = preceding.split('\n').length + 2;
  await markdown(page, `${preceding}\n\n| A | B |\n| --- | --- |\n| ${tall} | x |\n\n${following}`);
  const table = page.getByRole('table', { name: 'Markdown table', exact: true });
  const bounds = () =>
    table.evaluate((table, line) => {
      const widget = table.closest('.md-table-widget');
      const tableBox = table.getBoundingClientRect(),
        widgetBox = widget.getBoundingClientRect();
      const gutters = table
        .closest('.cm-scroller')
        .querySelectorAll('.cm-lineNumbers .cm-gutterElement');
      const first = [...gutters].find((gutter) => gutter.textContent === String(line));
      const next = [...gutters].find((gutter) => gutter.textContent === String(line + 3));
      return {
        top: tableBox.top - widgetBox.top,
        bottom: widgetBox.bottom - tableBox.bottom,
        firstLineOffset: first ? tableBox.top - first.getBoundingClientRect().top : null,
        nextLineOffset: next ? next.getBoundingClientRect().top - tableBox.bottom : null,
        nextLineText: widget.nextElementSibling?.textContent,
        font: getComputedStyle(table).fontFamily,
        size: getComputedStyle(table).fontSize,
      };
    }, headerLine);
  await input(page).evaluate((dom, position) => {
    const view = dom.cmTile.root.view;
    view.scrollDOM.scrollTop = view.lineBlockAt(position).top;
  }, preceding.length + 2);
  const layout = await bounds();
  expect(layout).toMatchObject({ top: 0, bottom: 0, nextLineText: '', size: '16px' });
  expect(Math.abs(layout.firstLineOffset ?? Infinity)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.nextLineOffset ?? Infinity)).toBeLessThanOrEqual(1);
  expect((await bounds()).font).toMatch(/^Calibri/);
  await table.getByRole('columnheader', { name: 'Row 1, column 1', exact: true }).click();
  await page.keyboard.press('ArrowDown');
  const cell = page.getByRole('textbox', { name: 'Table row 2 column 1', exact: true });
  await select(cell, tall.replaceAll('<br>', '\n').length);

  const measure = (gap) =>
    cell.evaluate((dom, gap) => {
      const view = dom.cmTile.root.view;
      const scroller = dom
        .closest('.markdown-host')
        .querySelector(':scope > .cm-editor > .cm-scroller');
      const viewport = scroller.getBoundingClientRect();
      const coords = () => view.coordsAtPos(view.state.selection.main.head, -1);
      if (gap !== undefined)
        scroller.scrollTop += coords().bottom - (viewport.top + scroller.clientHeight - gap);
      const box = coords();
      return {
        top: scroller.scrollTop,
        gap: viewport.top + scroller.clientHeight - box.bottom,
        lineHeight: box.bottom - box.top,
      };
    }, gap);
  await measure(3);
  const visible = await measure();
  expect(visible.gap).toBeGreaterThan(1);
  expect(visible.gap).toBeLessThan(5);
  await page.keyboard.press('z');
  await expect.poll(() => text(page)).toContain('line 25z');
  expect((await measure()).top).toBe(visible.top);
  await page.keyboard.press('Backspace');
  await expect.poll(() => text(page)).toContain('line 25 |');
  expect((await measure()).top).toBe(visible.top);

  await page.keyboard.press('Shift+Enter');
  await expect.poll(() => text(page)).toContain('line 25<br>');
  const afterBreak = await measure();
  expect(afterBreak.top - visible.top).toBeGreaterThan(10);
  expect(Math.abs(afterBreak.gap)).toBeLessThanOrEqual(1);
  await page.keyboard.press('z');
  await expect.poll(() => text(page)).toContain('line 25<br>z');
  const clipped = await measure(-16);
  await page.keyboard.press('Backspace');
  await expect.poll(() => text(page)).toContain('line 25<br> |');
  const revealed = await measure();
  expect(Math.abs(revealed.top - clipped.top + clipped.gap)).toBeLessThanOrEqual(1);
  expect(Math.abs(revealed.gap)).toBeLessThanOrEqual(1);
  await expect(cell).toBeFocused();

  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.setViewportSize({ width: 900, height: 640 });
  expect(await bounds()).toMatchObject({ top: 0, bottom: 0, size: '16px' });
});
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

  await page.getByRole('cell', { name: 'Row 2, column 12', exact: true }).click();
  const farCell = page.getByRole('textbox', { name: 'Table row 2 column 12', exact: true });
  await select(farCell, 1);
  const horizontal = (reset = false) =>
    farCell.evaluate((dom, reset) => {
      const view = dom.cmTile.root.view;
      const scroll = dom.closest('.md-table-scroll');
      if (reset) scroll.scrollLeft = 0;
      const right = scroll.getBoundingClientRect().left + scroll.clientWidth;
      return {
        left: scroll.scrollLeft,
        gap: right - view.coordsAtPos(view.state.selection.main.head).right,
      };
    }, reset);
  const hiddenCaret = await horizontal(true);
  expect(hiddenCaret.gap).toBeLessThan(-100);
  await page.keyboard.press('z');
  await expect.poll(() => text(page)).toContain('| xz |');
  const revealedCaret = await horizontal();
  expect(revealedCaret.left).toBeGreaterThan(100);
  expect(Math.abs(revealedCaret.gap)).toBeLessThanOrEqual(1);
});

test('final-cell Tab preserves the table viewport and reveals the new caret only as needed', async ({
  page,
}) => {
  const source = [
    'Before\n\n'.repeat(30),
    '| A | B |\n| --- | --- |\n',
    Array.from({ length: 48 }, (_, index) => `| ${index} | tail |`).join('\n'),
    '\n\n' + 'After\n\n'.repeat(30),
  ].join('');
  await markdown(page, source);
  await input(page).evaluate((dom, position) => {
    const view = dom.cmTile.root.view;
    view.scrollDOM.scrollTop = view.lineBlockAt(position).top;
  }, source.indexOf('| A | B |'));
  const last = page.getByRole('cell', { name: 'Row 49, column 2', exact: true });
  const measure = (target, gap) =>
    target.evaluate((dom, gap) => {
      const view = dom.cmTile.root.view;
      const scroller = dom
        .closest('.markdown-host')
        .querySelector(':scope > .cm-editor > .cm-scroller');
      const bottom = () => scroller.getBoundingClientRect().top + scroller.clientHeight;
      const caret = () => view.coordsAtPos(view.state.selection.main.head, -1).bottom;
      if (gap !== undefined) scroller.scrollTop += caret() + gap - bottom();
      return { top: scroller.scrollTop, gap: bottom() - caret() };
    }, gap);
  for (const gap of [120, 0]) {
    await last.click();
    const from = page.getByRole('textbox', { name: 'Table row 49 column 2', exact: true });
    const before = await measure(from, gap);
    await page.keyboard.press('Tab');
    const to = page.getByRole('textbox', { name: 'Table row 50 column 1', exact: true });
    await expect(to).toBeFocused();
    const after = await measure(to);
    if (gap) expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
    else {
      expect(after.top - before.top).toBeGreaterThan(0);
      expect(Math.abs(after.gap)).toBeLessThanOrEqual(2);
    }
    await page.keyboard.press('ControlOrMeta+Z');
    await expect.poll(() => text(page)).toBe(source);
  }
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

test('outline clicks mark the exact nested heading across modes and hand off to manual scrolling', async ({
  page,
}) => {
  const short = '# First\n\n## Parent\n\n### Child';
  await page.setViewportSize({ width: 1280, height: 1400 });
  await markdown(page, short);
  await page.getByRole('button', { name: 'Table of contents', exact: true }).click();
  const list = page.getByRole('navigation', { name: 'Document headings' });
  const heading = (name) => list.getByRole('button', { name, exact: true });
  const modes = ['Live Preview', 'Source', 'Reading'];
  for (const mode of modes) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await heading('Child').click();
    await expect(heading('Child')).toHaveAttribute('aria-current', 'location');
    await heading('Parent').click();
    await expect(heading('Parent')).toHaveAttribute('aria-current', 'location');
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Source', exact: true }).click();
  const paragraph = '\n\nA line between the headings.'.repeat(42);
  const long = '# First' + paragraph + '\n\n## Parent' + paragraph + '\n\n### Child' + paragraph;
  await input(page).evaluate((node, source) => {
    const view = node.cmTile.root.view;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
  }, long);
  for (const mode of modes) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await heading('Child').click();
    await expect(heading('Child')).toHaveAttribute('aria-current', 'location');
    if (mode !== 'Reading') {
      expect(
        await input(page).evaluate((node) => node.cmTile.root.view.state.selection.main.head),
      ).toBe(long.indexOf('### Child'));
    }
    await input(page).evaluate((node) => {
      node.cmTile.root.view.scrollDOM.scrollTop = 0;
    });
    await expect(heading('First')).toHaveAttribute('aria-current', 'location');
  }
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
