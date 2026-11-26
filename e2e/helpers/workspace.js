import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { runWorkspaceAction } from './application.js';
async function enterSql(page, source) {
  const editor = page.locator('.cm-editor:visible');
  await expect(editor).toBeVisible();
  await editor.click({ position: { x: 150, y: 35 } });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(source);
}
async function readSql(page, path) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export SQL', exact: true }).click();
  await (await download).saveAs(path);
  return readFile(path, 'utf8');
}
async function renameTab(page, current, name) {
  await page.getByRole('tab', { name: current, exact: true }).dblclick();
  const input = page.getByRole('textbox', { name: 'Session name', exact: true });
  await input.fill(name);
  await input.press('Enter');
}
async function dropFiles(page, target, files, surface = target) {
  const transfer = await page.evaluateHandle((values) => {
    const data = new DataTransfer();
    for (const value of values)
      data.items.add(new File([value.content], value.name, { type: 'text/plain' }));
    return data;
  }, files);
  try {
    await target.dispatchEvent('dragenter', { dataTransfer: transfer });
    await expect(target).toHaveClass(/file-drag-over/);
    await surface.dispatchEvent('dragover', { dataTransfer: transfer });
    await surface.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(target).not.toHaveClass(/file-drag-over/);
  } finally {
    await transfer.dispose();
  }
}
async function openFile(page, button, name, buffer) {
  const chooser = page.waitForEvent('filechooser');
  if (button === 'Import workspace') await runWorkspaceAction(page, button);
  else if (button === 'Open Markdown') await runMarkdownAction(page, button);
  else await page.getByRole('button', { name: button, exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer });
}

async function openMarkdownAction(page, name) {
  const checkable = ['Line numbers', 'Table of contents', 'Wide', 'Formatting toolbar'];
  const menu = checkable.includes(name) || name === 'Find' ? 'View' : 'Markdown actions';
  await page.getByRole('button', { name: menu, exact: true }).click();
  return page
    .getByRole('menu', { name: menu, exact: true })
    .getByRole(checkable.includes(name) ? 'menuitemcheckbox' : 'menuitem', { name, exact: true });
}

async function runMarkdownAction(page, name) {
  await (await openMarkdownAction(page, name)).click();
}

export { dropFiles, enterSql, openFile, openMarkdownAction, readSql, renameTab, runMarkdownAction };
