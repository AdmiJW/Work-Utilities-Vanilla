import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openApp } from './helpers/application.js';
import { openFile } from './helpers/workspace.js';
import { createScreenshot } from './helpers/screenshots.js';

const outer = (page) => page.locator('.markdown-host > .cm-editor > .cm-scroller > .cm-content');
const cell = (page, r = 2, c = 1) =>
  page.getByRole('textbox', { name: `Table row ${r} column ${c}`, exact: true });
async function select(locator, anchor, head = anchor) {
  await locator.evaluate(
    (dom, { anchor, head }) => {
      if (dom.tagName === 'TEXTAREA') {
        dom.focus();
        dom.setSelectionRange(
          Math.min(anchor, head),
          Math.max(anchor, head),
          anchor > head ? 'backward' : 'forward',
        );
      } else {
        const v = dom.cmTile.root.view;
        v.dispatch({ selection: { anchor, head } });
        v.focus();
      }
    },
    { anchor, head },
  );
}
async function text(page) {
  return outer(page).evaluate((dom) => dom.cmTile.root.view.state.doc.toString());
}
async function markdown(page, source) {
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await openFile(page, 'Open Markdown', 'edit.md', Buffer.from(source));
  await expect(outer(page)).toBeVisible();
}
async function reset(page, source) {
  await outer(page).evaluate((dom, source) => {
    const v = dom.cmTile.root.view;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: source },
      selection: { anchor: 0 },
    });
    v.focus();
  }, source);
}
async function paste(locator, text) {
  await locator.evaluate((dom, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    dom.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }),
    );
  }, text);
}

test('all three tools indent lines with isolated undo, reverse selections and CRLF persistence', async ({
  page,
}, info) => {
  await openApp(page);
  const original = 'alpha\r\nbeta\r\ngamma';
  for (const [tool, open, name, label] of [
    ['SQL Formatter', 'Open SQL', 'sample.sql', 'SQL editor'],
    ['DER/DPR Output Analyzer', 'Open TXT', 'sample.txt', 'Execution output'],
    ['Markdown Editor', 'Open Markdown', 'sample.md', 'Markdown editor'],
  ]) {
    await page.getByRole('button', { name: `New ${tool} session`, exact: true }).click();
    await openFile(page, open, name, Buffer.from(original));
    const input = page.getByRole('textbox', { name: label, exact: true });
    await expect
      .poll(() =>
        input.evaluate((dom) =>
          dom.tagName === 'TEXTAREA' ? dom.value : dom.cmTile.root.view.state.doc.toString(),
        ),
      )
      .toBe(original.replaceAll('\r\n', '\n'));
    await select(input, 11, 2);
    await page.keyboard.press('Tab');
    const expected = '    alpha\n    beta\ngamma';
    if (label === 'Execution output') await expect(input).toHaveValue(expected);
    else await expect(input).toHaveText(expected.replaceAll('\n', ''));
    expect(
      await input.evaluate((dom) =>
        dom.tagName === 'TEXTAREA'
          ? dom.selectionDirection
          : dom.cmTile.root.view.state.selection.main.anchor >
              dom.cmTile.root.view.state.selection.main.head
            ? 'backward'
            : 'forward',
      ),
    ).toBe('backward');
    await page.keyboard.press('ControlOrMeta+Z');
    if (label === 'Execution output')
      await expect(input).toHaveValue(original.replaceAll('\r\n', '\n'));
    else
      expect(await input.evaluate((dom) => dom.cmTile.root.view.state.doc.toString())).toBe(
        original.replaceAll('\r\n', '\n'),
      );
    await page.keyboard.press('ControlOrMeta+Y');
    await page.keyboard.press('Shift+Tab');
    await select(input, 2);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(input).not.toBeFocused();
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const path = info.outputPath('indentation.json');
  await (await pending).saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(backup.documents.map((d) => d.source)).toEqual(
    Array(3).fill('    alpha\r\nbeta\r\ngamma'),
  );
});

test('Markdown list guards enforce the agreed examples and atomic selections in both editable modes', async ({
  page,
}) => {
  const original = '- Lvl 1\n    - Lvl 2a\n    - Lvl 2b';
  await markdown(page, original);
  for (const mode of ['Live Preview', 'Source']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    for (const [needle, key, expected] of [
      ['Lvl 1', 'Tab', original],
      ['Lvl 1', 'Shift+Tab', original],
      ['Lvl 2a', 'Tab', original],
      ['Lvl 2a', 'Shift+Tab', '- Lvl 1\n- Lvl 2a\n    - Lvl 2b'],
      ['Lvl 2b', 'Tab', '- Lvl 1\n    - Lvl 2a\n        - Lvl 2b'],
      ['Lvl 2b', 'Shift+Tab', '- Lvl 1\n    - Lvl 2a\n- Lvl 2b'],
    ]) {
      await reset(page, original);
      await select(outer(page), original.indexOf(needle));
      await page.keyboard.press(key);
      expect(await text(page)).toBe(expected);
    }
    const subtree = '- A\n- B\n    - C';
    await reset(page, subtree);
    await select(outer(page), subtree.indexOf('B'));
    await page.keyboard.press('Tab');
    expect(await text(page)).toBe(subtree);
    await select(outer(page), subtree.indexOf('B'), subtree.length);
    await page.keyboard.press('Tab');
    expect(await text(page)).toBe('- A\n    - B\n        - C');
    await page.keyboard.press('ControlOrMeta+Z');
    expect(await text(page)).toBe(subtree);
  }
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await outer(page).focus();
  await page.keyboard.press('Tab');
  await expect(outer(page)).not.toBeFocused();
});

test('cell arrows and Tab use collapsed carets and row-major boundaries without source edits', async ({
  page,
}) => {
  const original =
    'Before\n\n| A | B |\n| --- | --- |\n| alpha | beta |\n| gamma | delta |\n\nAfter';
  await markdown(page, original);
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  await select(cell(page), 5);
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 2, 2)).toBeFocused();
  expect(
    await cell(page, 2, 2).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head),
  ).toBe(0);
  await page.keyboard.press('ArrowLeft');
  await expect(cell(page)).toBeFocused();
  expect(await cell(page).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(
    5,
  );
  await page.keyboard.press('Tab');
  await select(cell(page, 2, 2), 4);
  await page.keyboard.press('ArrowRight');
  await expect(cell(page, 3, 1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(cell(page, 2, 2)).toBeFocused();
  await select(cell(page, 2, 2), 0);
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(cell(page, 2, 2)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await select(cell(page, 3, 2), 5);
  await page.keyboard.press('ArrowRight');
  await expect(outer(page)).toBeFocused();
  expect(await text(page)).toBe(original);
  expect(await outer(page).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(
    original.indexOf('After'),
  );
  await page.getByRole('columnheader', { name: 'Row 1, column 1', exact: true }).click();
  await select(cell(page, 1, 1), 0);
  await page.keyboard.press('Shift+Tab');
  await expect(outer(page)).toBeFocused();
  expect(await text(page)).toBe(original);
  expect(await outer(page).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(
    'Before'.length,
  );
});

test('cell breaks and paste remain one undo step, split code and reject destination breaks', async ({
  page,
}) => {
  const original = '| A | B |\n| --- | --- |\n| ab | x |';
  await markdown(page, original);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  await select(cell(page), 1);
  await page.keyboard.press('Shift+Enter');
  await expect(cell(page)).toHaveText('ab');
  expect(await cell(page).evaluate((dom) => dom.cmTile.root.view.state.doc.toString())).toBe(
    'a\nb',
  );
  expect(await text(page)).toBe(original.replace('| ab |', '| a<br>b |'));
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(original);
  await page.keyboard.press('ControlOrMeta+Y');
  await paste(cell(page), 'X\nY|Z\n');
  expect(await text(page)).toContain('a<br>X<br>Y\\|Z<br>b');
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(original.replace('| ab |', '| a<br>b |'));
  await page.keyboard.press('Escape');
  await reset(page, original.replace('ab', '`ab`'));
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  await select(cell(page), 2);
  await page.keyboard.press('Shift+Enter');
  expect(await text(page)).toContain('`a`<br>`b`');
  expect(await cell(page).evaluate((dom) => dom.cmTile.root.view.state.selection.main.head)).toBe(
    5,
  );
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toContain('`ab`');
  await page.keyboard.press('Escape');
  const link = original.replace('ab', '[x](https://example.com)');
  await reset(page, link);
  await page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).click();
  await select(cell(page), 12);
  await page.keyboard.press('Shift+Enter');
  expect(await text(page)).toBe(link);
  await expect(page.locator('.md-edit-status')).toContainText('destination');
  await paste(cell(page), 'a\nb');
  expect(await text(page)).toBe(link);
  expect(errors).toEqual([]);
});

test('break projections preserve source spelling through search, formatting, images and reload', async ({
  page,
}) => {
  await openApp(page);
  const image = await createScreenshot(page, 'tiny.png', 20, 12);
  const url = `data:image/png;base64,${image.buffer.toString('base64')}`;
  const original = `| A | B |\n| --- | --- |\n| before<BR />after<br/>![tiny](${url}) | \\<br> \`literal<br>code\` |`;
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await openFile(page, 'Open Markdown', 'projection.md', Buffer.from(original));
  await page.getByRole('button', { name: 'Find', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find', exact: true }).fill('after');
  await page.getByRole('button', { name: 'Next match', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(cell(page)).toBeFocused();
  expect(
    await cell(page).evaluate((dom) => {
      const v = dom.cmTile.root.view,
        r = v.state.selection.main;
      return v.state.sliceDoc(r.from, r.to);
    }),
  ).toBe('after');
  await outer(page).evaluate((dom) =>
    dom.cmTile.root.view.dispatch({ changes: { from: 0, insert: 'Intro\n\n' } }),
  );
  await expect(cell(page)).toBeFocused();
  await page.keyboard.press('ControlOrMeta+F');
  await expect(page.getByRole('textbox', { name: 'Find', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+B');
  expect(await text(page)).toContain('before<BR />**after**<br/>![tiny]');
  await page.getByRole('button', { name: 'Alt text', exact: true }).click();
  await page.getByRole('textbox', { name: 'Alt text', exact: true }).fill('changed');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await text(page)).toContain(`![changed](${url})`);
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toContain(`![tiny](${url})`);
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Row 2, column 1', exact: true }).locator('br'),
  ).toHaveCount(2);
  await expect(page.getByRole('cell', { name: 'Row 2, column 2', exact: true })).toContainText(
    'literal<br>code',
  );
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.manual-save-feedback')).toContainText('Saved');
  await page.reload();
  await expect(outer(page)).toBeVisible();
  await expect.poll(() => text(page)).toContain('before<BR />**after**<br/>![tiny]');
});

test('vertical entry targets visible line ends and mouse hits after breaks map to source', async ({
  page,
}) => {
  const long = 'wrapped words for the first visible line '.repeat(12);
  const original = `Before\n\n| A | B |\n| --- | --- |\n| ${long}<br>SECOND | x |\n| tail<br>last | y |\n\nAfter`;
  await markdown(page, original);
  await page.getByRole('columnheader', { name: 'Row 1, column 1', exact: true }).click();
  await page.keyboard.press('ArrowDown');
  await expect(cell(page)).toBeFocused();
  const position = await cell(page).evaluate((dom) => {
    const v = dom.cmTile.root.view,
      r = v.state.selection.main,
      first = v.coordsAtPos(0, 1),
      current = v.coordsAtPos(r.head, r.assoc || 1);
    return {
      head: r.head,
      firstLine: v.state.doc.line(1).length,
      sameLine: Math.abs(first.top - current.top) < 2,
      atWrap: v.coordsAtPos(r.head, 1).top > current.top + 2,
      empty: r.empty,
    };
  });
  expect(position.empty).toBe(true);
  expect(position.head).toBeGreaterThan(5);
  expect(position.head).toBeLessThan(position.firstLine);
  expect(position.sameLine).toBe(true);
  expect(position.atWrap).toBe(true);
  await select(cell(page), 0);
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, 1, 1)).toBeFocused();
  await select(outer(page), original.indexOf('After'));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(cell(page, 3, 1)).toBeFocused();
  expect(
    await cell(page, 3, 1).evaluate((dom) => {
      const v = dom.cmTile.root.view;
      return v.state.selection.main.head === v.state.doc.length;
    }),
  ).toBe(true);
  await page.keyboard.press('Escape');
  const td = page.getByRole('cell', { name: 'Row 2, column 1', exact: true });
  await td.scrollIntoViewIfNeeded();
  const point = await td.evaluate((dom) => {
    const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode()))
      if (n.textContent.includes('SECOND')) {
        const range = document.createRange();
        range.setStart(n, n.textContent.indexOf('SECOND') + 3);
        range.setEnd(n, n.textContent.indexOf('SECOND') + 4);
        const r = range.getBoundingClientRect();
        return { x: r.left + 0.2, y: (r.top + r.bottom) / 2 };
      }
    throw Error('Missing second line');
  });
  await page.mouse.click(point.x, point.y);
  await page.keyboard.insertText('X');
  expect(await text(page)).toBe(original.replace('SECOND', 'SECXOND'));
  await page.keyboard.press('ControlOrMeta+Z');
  expect(await text(page)).toBe(original);
});
