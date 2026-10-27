import { decodeBase64, encodeBase64, identifyImage } from '../../shared/image-data.js';

export async function exportBackupImages(state, documents) {
  const images = [];
  for (const document of documents) {
    for (const reference of document.unitTestImages ?? []) {
      const { blob } = await state.images.read(reference.id);
      images.push({
        id: reference.id,
        sessionId: document.id,
        data: encodeBase64(new Uint8Array(await blob.arrayBuffer())),
      });
    }
  }
  return images;
}

export function validateBackupImages(backup, invalid) {
  const images = backup.schemaVersion === 1 ? [] : backup.images;
  if (!Array.isArray(images)) invalid();
  const known = new Map();
  for (const image of images) {
    if (!image || typeof image.id !== 'string' || known.has(image.id)) invalid();
    known.set(image.id, image);
  }
  const used = new Set();
  for (const document of backup.documents) {
    if (document.unitTestImages !== undefined && !Array.isArray(document.unitTestImages)) invalid();
    for (const reference of document.unitTestImages ?? []) {
      const image = known.get(reference?.id);
      const summary = backup.summaries.find((item) => item.id === document.id);
      if (
        !image ||
        image.sessionId !== document.id ||
        summary.toolId !== 'sql-formatter' ||
        used.has(image.id) ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(image.id) ||
        typeof reference.name !== 'string'
      )
        invalid();
      try {
        const metadata = identifyImage(decodeBase64(image.data));
        if (
          metadata.type !== reference.type ||
          metadata.width !== reference.width ||
          metadata.height !== reference.height ||
          !metadata.width ||
          !metadata.height
        )
          invalid();
      } catch {
        invalid();
      }
      used.add(image.id);
    }
  }
  if (used.size !== known.size) invalid();
}

export function restoreBackupImages(backup) {
  return (backup.images ?? []).map(({ id, sessionId, data }) => {
    const bytes = decodeBase64(data);
    return { id, sessionId, blob: new Blob([bytes], { type: identifyImage(bytes).type }) };
  });
}
