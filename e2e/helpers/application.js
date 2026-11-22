import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

export async function openApp(page, ready = true) {
  const file = test.info().project.metadata.mode === 'file';
  if (file) await page.context().route(/^https?:\/\//, (route) => route.abort());
  await page.goto(file ? pathToFileURL(resolve('dist/work-utilities.html')).href : '/');
  if (ready) await expect(page.getByRole('button', { name: 'Workspace actions' })).toBeVisible();
}

export async function openLocalFile(page, label, path) {
  const choosing = page.waitForEvent('filechooser');
  if (label === 'Import workspace') await runWorkspaceAction(page, label);
  else await page.getByRole('button', { name: label, exact: true }).click();
  await (await choosing).setFiles(path);
}

export async function runWorkspaceAction(page, name) {
  await page.getByRole('button', { name: 'Workspace actions', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

export async function startSession(page, name) {
  const navigation = page.getByRole('button', { name: 'Open workspace navigation' });
  if (await navigation.isVisible()) await navigation.click();
  await page.getByRole('button', { name: `New ${name} session`, exact: true }).click();
  await expect(page.locator('.navigation-drawer')).toHaveCount(0);
}

export async function moveWorkspaceToOfflineFile(page, info) {
  const backup = page.waitForEvent('download');
  await runWorkspaceAction(page, 'Export workspace');
  const workspacePath = info.outputPath('transfer-workspace.json');
  await (await backup).saveAs(workspacePath);
  const saved = JSON.parse(await readFile(workspacePath, 'utf8'));
  const application = page.waitForEvent('download');
  await runWorkspaceAction(page, 'Download offline app');
  const htmlPath = info.outputPath('offline-application.html');
  await (await application).saveAs(htmlPath);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(htmlPath).href);
  await openLocalFile(page, 'Import workspace', workspacePath);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Restore workspace?', exact: true })).toHaveCount(
    0,
  );
  await expect(page.locator('.saved-count')).toHaveText(String(saved.summaries.length));
  await expect(page.locator('.workspace')).toHaveAttribute('aria-busy', 'false');
}
