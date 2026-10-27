import { identifyImage, validateImageBlob } from '../../shared/image-data.js';

export async function readScreenshot(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = identifyImage(bytes);
  const blob = new Blob([bytes], { type: metadata.type });
  await validateImageBlob(blob);
  if (!metadata.width || !metadata.height)
    throw new Error('This screenshot has invalid dimensions.');
  return { ...metadata, name: file.name || 'Clipboard screenshot.png', blob };
}
