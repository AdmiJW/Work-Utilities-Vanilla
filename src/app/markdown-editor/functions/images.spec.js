import { describe, it, expect } from 'vitest';
import { imageMetadata, readEmbeddedImage } from './images.js';
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jwVIAAAAASUVORK5CYII=',
    'base64',
  ),
);
describe('offline Markdown images', () => {
  it('checks binary signatures and dimensions rather than extensions', () => {
    expect(imageMetadata(png)).toEqual({ width: 1, height: 1, type: 'image/png' });
    expect(() => imageMetadata(new Uint8Array([1, 2, 3]))).toThrow('valid PNG or JPEG');
    const huge = png.slice();
    new DataView(huge.buffer).setUint32(16, 20_000);
    new DataView(huge.buffer).setUint32(20, 20_000);
    expect(() => imageMetadata(huge)).toThrow('16 megapixels');
  });
  it('accepts only bounded embedded PNG/JPEG with matching MIME signatures', () => {
    expect(
      readEmbeddedImage(`data:image/png;base64,${Buffer.from(png).toString('base64')}`),
    ).toMatchObject({ width: 1 });
    for (const value of [
      'https://example.com/a.png',
      'relative.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      `data:image/jpeg;base64,${Buffer.from(png).toString('base64')}`,
    ])
      expect(readEmbeddedImage(value)).toBeNull();
  });
});
