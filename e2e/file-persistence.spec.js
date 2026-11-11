import { test, expect } from '@playwright/test';
import { openApp } from './helpers/application.js';
import { createScreenshot, uploadScreenshots } from './helpers/screenshots.js';
import { readFile, writeFile } from 'node:fs/promises';

const input = (page) => page.locator('.markdown-host > .cm-editor > .cm-scroller > .cm-content');
async function installPickers(page) {
  const directFile = test.info().project.metadata.mode === 'file';
  if (directFile) {
    const path = test.info().outputPath('test-workspace.json');
    await writeFile(path, '');
    await page.exposeBinding('__workspaceFileRead', () => readFile(path, 'utf8'));
    await page.exposeBinding('__workspaceFileWrite', (_context, text) =>
      writeFile(path, text, 'utf8'),
    );
  }
  await page.addInitScript((directFile) => {
    if (directFile) {
      // OPFS denies file:// origins. Exercise the same handle contract against an
      // actual external test file; hosted projects use native cloneable handles.
      const handle = {
        name: 'test-workspace.json',
        kind: 'file',
        queryPermission: async () => 'granted',
        requestPermission: async () => 'granted',
        getFile: async () => new File([await window.__workspaceFileRead()], 'test-workspace.json'),
        createWritable: async () => {
          if (window.failNextFileWrite) {
            window.failNextFileWrite = false;
            throw new DOMException('Disk write denied', 'NotAllowedError');
          }
          let text;
          return {
            write: async (value) => {
              text = value;
            },
            close: () => window.__workspaceFileWrite(text),
            abort: async () => {},
          };
        },
      };
      window.workspaceHandle = async () => handle;
      const put = IDBObjectStore.prototype.put,
        get = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.put = function (value, ...args) {
        if (this.name === 'storageConnections' && value.value?.handle)
          value = { ...value, value: { ...value.value, handle: { fixtureFile: true } } };
        return put.call(this, value, ...args);
      };
      IDBObjectStore.prototype.get = function (...args) {
        const request = get.apply(this, args);
        if (this.name === 'storageConnections')
          request.addEventListener('success', () => {
            if (request.result?.value?.handle?.fixtureFile) request.result.value.handle = handle;
          });
        return request;
      };
    } else
      window.workspaceHandle = async () =>
        (await navigator.storage.getDirectory()).getFileHandle('test-workspace.json', {
          create: true,
        });
    window.showSaveFilePicker = () => window.workspaceHandle();
    window.showOpenFilePicker = async () => [await window.workspaceHandle()];
    const original = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...args) {
      if (window.failNextFileWrite) {
        window.failNextFileWrite = false;
        throw new DOMException('Disk write denied', 'NotAllowedError');
      }
      return original.apply(this, args);
    };
  }, directFile);
}
async function replaceSource(page, source) {
  await input(page).evaluate((dom, source) => {
    const view = dom.cmTile.root.view;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: source },
      userEvent: 'input.type',
    });
    view.focus();
  }, source);
}
async function fileText(page) {
  return page.evaluate(async () =>
    JSON.parse(await (await (await window.workspaceHandle()).getFile()).text()),
  );
}
test('file saves survive handle restoration and Browser metadata removal, then carry back into Browser', async ({
  page,
}) => {
  await installPickers(page);
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await replaceSource(page, '# Browser draft');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Create from current workspace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'File', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  expect((await fileText(page)).documents[0].source).toBe('# Browser draft');
  await replaceSource(page, '# File draft');
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.manual-save-feedback')).toContainText(
    'Saved workspace to test-workspace.json',
  );
  expect((await fileText(page)).documents[0].source).toBe('# File draft');
  await page.reload();
  await expect(page.getByRole('button', { name: 'File', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(input(page)).toContainText('File draft');
  // Remove all browser workspace data, retaining the independent file's bytes.
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('work-utilities-vanilla');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const stores = [
        'storageConnections',
        'summaries',
        'documents',
        'preferences',
        'sessionImages',
      ];
      const transaction = db.transaction(stores, 'readwrite');
      for (const name of stores) transaction.objectStore(name).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Browser', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Open existing workspace file', exact: true }).click();
  await page.getByRole('button', { name: 'Open workspace', exact: true }).click();
  await expect(input(page)).toContainText('File draft');
  await page.getByRole('button', { name: 'Browser', exact: true }).click();
  await page.getByRole('button', { name: 'Use Browser storage', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Browser', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(input(page)).toContainText('File draft');
});

test('failed file writes retain drafts and external changes require explicit overwrite', async ({
  page,
}) => {
  await installPickers(page);
  await openApp(page);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await replaceSource(page, 'original');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Create from current workspace', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  await replaceSource(page, 'recover me');
  await page.evaluate(() => {
    window.failNextFileWrite = true;
  });
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.storage-notice')).toContainText('Disk write denied');
  await expect(input(page)).toContainText('recover me');
  expect((await fileText(page)).documents[0].source).toBe('original');
  await page.getByRole('button', { name: 'Retry file save', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  await page.evaluate(async () => {
    const handle = await window.workspaceHandle(),
      value = JSON.parse(await (await handle.getFile()).text());
    value.documents[0].source = 'external';
    const stream = await handle.createWritable();
    await stream.write(JSON.stringify(value));
    await stream.close();
  });
  await replaceSource(page, 'my latest');
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.storage-notice')).toContainText('changed outside');
  expect((await fileText(page)).documents[0].source).toBe('external');
  await page.getByRole('button', { name: 'Overwrite file', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Overwrite workspace file?' })
    .getByRole('button', { name: 'Overwrite file', exact: true })
    .click();
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  expect((await fileText(page)).documents[0].source).toBe('my latest');
});

test('unavailable pickers retain Browser storage and explain the limitation', async ({ page }) => {
  await page.addInitScript(() => {
    window.showOpenFilePicker = undefined;
    window.showSaveFilePicker = undefined;
  });
  await openApp(page);
  await expect(page.getByRole('button', { name: 'File', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'File', exact: true })).toHaveAttribute(
    'title',
    /unavailable/,
  );
  await expect(page.getByRole('button', { name: 'Browser', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('complete file workspaces retain cold screenshot sessions and reuse a chosen file after Browser mode', async ({
  page,
}) => {
  await installPickers(page);
  await openApp(page);
  await page.getByRole('button', { name: 'New SQL Formatter session', exact: true }).click();
  await page.getByRole('button', { name: 'Unit Test (0)', exact: true }).click();
  const image = await createScreenshot(page, 'evidence.png', 120, 60);
  await uploadScreenshots(page, [image]);
  await expect(page.locator('.screenshot-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'New Markdown Editor session', exact: true }).click();
  await replaceSource(page, 'note');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Create from current workspace', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  expect((await fileText(page)).images[0].data).toBe(image.buffer.toString('base64'));
  await page.reload();
  await page.getByRole('tab', { name: 'SQL Formatter 01', exact: true }).click();
  await expect(page.locator('.screenshot-card img')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+S');
  await expect(page.locator('.save-status')).toContainText('All changes saved');
  await page.getByRole('button', { name: 'Browser', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Replace browser workspace?' });
  await confirmation.getByRole('button', { name: 'Use Browser storage', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Browser', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByRole('button', { name: 'Use previous workspace file', exact: true }).click();
  const fileConfirmation = page.getByRole('dialog', { name: 'Replace workspace file?' });
  await fileConfirmation.getByRole('button', { name: 'Use previous file', exact: true }).click();
  await expect(page.getByRole('button', { name: 'File', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await fileText(page)).images[0].data).toBe(image.buffer.toString('base64'));
});
