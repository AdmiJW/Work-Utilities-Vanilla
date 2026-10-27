import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { exportUnitTest } from './export-unit-test.js';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTHcAAAAASUVORK5CYII=';
describe('unit-test workbooks', () => {
  it('embeds original images on one sheet in order with original display dimensions and a 24px gap', async () => {
    const images = [
      { data: png, type: 'image/png', width: 800, height: 320 },
      { data: png, type: 'image/png', width: 600, height: 240 },
    ];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await exportUnitTest({ images }));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Unit Test']);
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(0);
    const media = sheet.getImages();
    expect(media).toHaveLength(2);
    expect(media[0].range.ext).toEqual({ width: 800, height: 320 });
    expect(media[1].range.ext).toEqual({ width: 600, height: 240 });
    expect(media[1].range.tl.row).toBeCloseTo((320 + 24) / 20);
    expect(workbook.getImage(media[0].imageId).buffer.toString('base64')).toBe(png);
  });
  it('rejects an empty workbook', async () => {
    await expect(exportUnitTest({ images: [] })).rejects.toThrow('Add a screenshot');
  });
});
