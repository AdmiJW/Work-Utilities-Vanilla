async function readTextFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let encoding = 'utf-8';
  if (bytes[0] === 255 && bytes[1] === 254) encoding = 'utf-16le';
  else if (bytes[0] === 254 && bytes[1] === 255) encoding = 'utf-16be';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      'This file is not valid UTF-8 or BOM-marked UTF-16. Save it in one of those encodings and try again.',
    );
  }
}
export { readTextFile };
