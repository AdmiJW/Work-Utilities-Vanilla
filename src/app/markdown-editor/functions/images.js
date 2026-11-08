export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 16_000_000;

/** Read dimensions before decoding, without trusting extension or declared MIME type. */
export function imageMetadata(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width, height, type;
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) &&
    view.getUint32(12) === 0x49484452
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
    type = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 3 < bytes.length) {
      if (bytes[p++] !== 255) break;
      while (bytes[p] === 255) p++;
      const marker = bytes[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (p + 2 > bytes.length) break;
      const size = view.getUint16(p);
      if (size < 2 || p + size > bytes.length) break;
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) &&
        size >= 7
      ) {
        height = view.getUint16(p + 3);
        width = view.getUint16(p + 5);
        type = 'image/jpeg';
        break;
      }
      p += size;
    }
  }
  if (!width || !height || !type) throw new Error('Choose a valid PNG or JPEG image.');
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('Images must be at most 16 megapixels.');
  return { width, height, type };
}

export function readEmbeddedImage(url) {
  const match = /^data:(image\/(?:png|jpeg));base64,([a-z\d+/]*={0,2})$/i.exec(url);
  if (!match || match[2].length > 4 * Math.ceil(MAX_IMAGE_BYTES / 3)) return null;
  try {
    const raw = atob(match[2]);
    if (raw.length > MAX_IMAGE_BYTES) return null;
    const metadata = imageMetadata(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
    return metadata.type === match[1].toLowerCase() ? metadata : null;
  } catch {
    return null;
  }
}

export async function readImageFile(file) {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Each image must be at most 5 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = imageMetadata(bytes);
  const blob = new Blob([bytes], { type: metadata.type });
  const image = await createImageBitmap(blob).catch(() => {
    throw new Error('The image could not be decoded.');
  });
  image.close();
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
  const alt =
    file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[\\[\]\r\n]/g, ' ')
      .trim() || 'Image';
  return { url, alt, markdown: `![${alt}](${url})` };
}
