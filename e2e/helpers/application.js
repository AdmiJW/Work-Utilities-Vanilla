import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function openApp(page, ready = true) {
  const file = test.info().project.metadata.mode === 'file';
  if (file) await page.context().route(/^https?:\/\//, (route) => route.abort());
  await page.goto(file ? pathToFileURL(resolve('dist/work-utilities.html')).href : '/');
  if (ready) await expect(page.getByText('Offline ready', { exact: true })).toBeVisible();
}

export async function openLocalFile(page, label, path) {
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label, exact: true }).click();
  await (await choosing).setFiles(path);
}

export async function moveWorkspaceToOfflineFile(page, info) {
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export workspace', exact: true }).click();
  const workspacePath = info.outputPath('transfer-workspace.json');
  await (await backup).saveAs(workspacePath);
  const application = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download offline app', exact: true }).click();
  const htmlPath = info.outputPath('offline-application.html');
  await (await application).saveAs(htmlPath);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(htmlPath).href);
  await openLocalFile(page, 'Import workspace', workspacePath);
  await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
}
