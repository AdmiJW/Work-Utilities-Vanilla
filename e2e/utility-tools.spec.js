import { test, expect } from '@playwright/test';
import { openApp, startSession } from './helpers/application.js';

const source = (editor) => editor.evaluate((node) => node.cmTile.root.view.state.doc.toString());
const textEditor = (page, name) => page.getByRole('textbox', { name, exact: true });

async function replaceText(page, editor, text) {
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}

test('Diff Checker compares on demand and aligns editable, numbered panes', async ({ page }) => {
  await openApp(page);
  await startSession(page, 'Diff Checker');
  const left = textEditor(page, 'Left text');
  const right = textEditor(page, 'Right text');
  const compare = page.getByRole('button', { name: 'Compare', exact: true });
  const status = page.locator('.diff-status');
  const panes = page.locator('.diff-pane');
  const common = Array.from({ length: 40 }, (_, i) => `common ${i + 1}`).join('\n');
  const original = `top\nvalue old\nbottom\n${common}`;
  const update = `top\nvalue new\nadded line\nbottom\n${common}`;
  await replaceText(page, left, original);
  await replaceText(page, right, update);
  await expect(panes.locator('.cm-lineNumbers')).toHaveCount(2);
  await expect(status).toBeEmpty();
  await expect(page.locator('.diff-added')).toHaveCount(0);

  await compare.click();
  await expect(status).toContainText('changed');
  await expect(panes.first().locator('.diff-removed-text').first()).toContainText('old');
  await expect(panes.last().locator('.diff-added-text').first()).toContainText('new');
  const bottom = (pane) => pane.locator('.cm-line').filter({ hasText: /^bottom$/ });
  await expect
    .poll(async () => {
      const a = await bottom(panes.first()).boundingBox();
      const b = await bottom(panes.last()).boundingBox();
      return Math.abs(a.y - b.y);
    })
    .toBeLessThan(2);
  await panes
    .first()
    .locator('.cm-scroller')
    .evaluate((node) => (node.scrollTop = 220));
  await expect
    .poll(() =>
      panes
        .last()
        .locator('.cm-scroller')
        .evaluate((node) => node.scrollTop),
    )
    .toBe(220);
  expect(await source(left)).toBe(original);
  expect(await source(right)).toBe(update);

  await replaceText(page, right, original);
  await expect(page.locator('.diff-removed,.diff-added,.diff-alignment-space')).toHaveCount(0);
  await expect(status).toBeEmpty();

  await right.evaluate((node) => {
    // Edit in the same turn as Compare, before the worker can return.
    [...document.querySelectorAll('.diff-checker button')]
      .find((control) => control.textContent === 'Compare')
      .click();
    node.cmTile.root.view.dispatch({ changes: { from: 0, insert: 'new first line\n' } });
  });
  await expect(compare).toBeEnabled();
  await expect(status).toBeEmpty();
  await compare.click();
  await expect(status).toContainText('changed');
  await replaceText(page, right, original);
  await compare.click();
  await expect(status).toHaveText('Texts are identical.');
});

test('JSON Formatter preserves tokens, supports undo and remembers indentation', async ({
  page,
}) => {
  await openApp(page);
  await startSession(page, 'JSON Formatter');
  const editor = textEditor(page, 'JSON editor');
  const indentation = page.getByRole('combobox', { name: 'Indentation', exact: true });
  await expect(indentation).toHaveValue('2');
  const compact = String.raw`{"n":900719925474099312345,"text":[" a\n\u0020 "]}`;
  const pretty = `{
    "n": 900719925474099312345,
    "text": [
        " a\\n\\u0020 "
    ]
}`;
  await replaceText(page, editor, compact);
  await indentation.selectOption('4');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  expect(await source(editor)).toBe(pretty);
  await expect(page.locator('.json-formatter .cm-lineNumbers')).toBeVisible();
  const compactButton = page.getByRole('button', { name: 'One-line', exact: true });
  await compactButton.click();
  expect(await source(editor)).toBe(compact);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await source(editor)).toBe(pretty);
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.save-status')).toHaveText('All changes saved');
  await page.reload();
  await expect(indentation).toHaveValue('4');
  expect(await source(editor)).toBe(pretty);

  const malformed = '{"n":1,}';
  await replaceText(page, editor, malformed);
  await compactButton.click();
  await expect(page.locator('.json-formatter [role=alert]')).toContainText('Invalid JSON');
  expect(await source(editor)).toBe(malformed);
});

test('the header folder picker routes an existing draft on first edit and restores the choice', async ({
  page,
}) => {
  await openApp(page);
  const control = page.getByRole('button', { name: /^New session folder/ });
  await expect(control).toHaveAccessibleName('New session folder · Library root');
  await startSession(page, 'SQL Formatter');
  await replaceText(page, textEditor(page, 'SQL editor'), 'SELECT 1;');
  await page.keyboard.press('ControlOrMeta+s');
  await startSession(page, 'Diff Checker');

  const libraryButton = page.getByRole('button', { name: 'Open session library', exact: true });
  const library = page.getByRole('dialog', { name: 'Session library', exact: true });
  const folder = (dialog, name) =>
    dialog.getByRole('button', { name: `Open folder ${name}`, exact: true });
  await libraryButton.click();
  const create = async (name) => {
    await library.getByRole('button', { name: 'New folder', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'New folder', exact: true });
    await dialog.getByRole('textbox', { name: 'Folder name' }).fill(name);
    await dialog.getByRole('button', { name: 'Create folder', exact: true }).click();
    await expect(dialog).toBeHidden();
  };
  await create('Projects');
  await folder(library, 'Projects').click();
  await create('Review');
  await page.keyboard.press('Escape');
  await expect(library).toBeHidden();

  await control.press('Enter');
  const picker = page.getByRole('dialog', { name: 'New session folder', exact: true });
  await folder(picker, 'Projects').click();
  await folder(picker, 'Review').click();
  await picker.getByRole('button', { name: 'Use this folder', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(control).toHaveAccessibleName(
    'New session folder · Library root / Projects / Review',
  );

  const right = textEditor(page, 'Right text');
  await replaceText(page, right, 'Right-only draft');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.save-status')).toHaveText('All changes saved');
  await page.reload();
  await expect(control).toHaveAccessibleName(
    'New session folder · Library root / Projects / Review',
  );
  expect(await source(right)).toBe('Right-only draft');
  await libraryButton.click();
  await expect(library.locator('.saved-session')).toHaveCount(1);
  await expect(library.locator('.saved-session')).toContainText('SQL Formatter');
  await folder(library, 'Projects').click();
  await folder(library, 'Review').click();
  await expect(library.locator('.saved-session')).toHaveCount(1);
  await expect(library.locator('.saved-session')).toContainText('Diff Checker');
});
