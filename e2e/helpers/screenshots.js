import { expect } from '@playwright/test';

export async function createScreenshot(
  page,
  name = 'evidence.png',
  width = 640,
  height = 240,
  type = 'image/png',
) {
  const data = await page.evaluate(
    async ({ width, height, type }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#f8fafc';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#17243a';
      context.font = '18px monospace';
      context.fillText('Synthetic UAT screenshot', 20, 50);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type));
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { width, height, type },
  );
  return { name, mimeType: type, buffer: Buffer.from(data) };
}

export async function uploadScreenshots(page, files) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add images', exact: true }).click();
  await (await chooser).setFiles(files);
}

export async function pasteOrDropScreenshot(page, file, action) {
  const transfer = await page.evaluateHandle(
    ({ name, type, bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type }));
      return transfer;
    },
    { name: file.name, type: file.mimeType, bytes: [...file.buffer] },
  );
  const panel = page.getByRole('region', { name: 'Unit Test screenshots', exact: true });
  try {
    if (action === 'paste')
      await panel.evaluate((element, clipboardData) => {
        element.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
        );
      }, transfer);
    else {
      await panel.dispatchEvent('dragenter', { dataTransfer: transfer });
      await expect(panel).toHaveClass(/file-drag-over/);
      await panel.dispatchEvent('drop', { dataTransfer: transfer });
      await expect(panel).not.toHaveClass(/file-drag-over/);
    }
  } finally {
    await transfer.dispose();
  }
}
