import ExcelJS from 'exceljs';

export async function exportUnitTest({ images }) {
  if (!images.length) throw new Error('Add a screenshot before exporting the unit test.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Work Utilities';
  const sheet = workbook.addWorksheet('Unit Test');
  sheet.properties.defaultRowHeight = 15;
  let top = 0;
  for (const image of images) {
    if (top + image.height > 1048576 * 20)
      throw new Error(
        'The screenshots exceed Excel’s worksheet height limit. Remove images or split them into separate sessions.',
      );
    const id = workbook.addImage({
      base64: image.data,
      extension: image.type === 'image/png' ? 'png' : 'jpeg',
    });
    sheet.addImage(id, {
      tl: { col: 0, row: top / 20 },
      ext: { width: image.width, height: image.height },
      editAs: 'absolute',
    });
    top += image.height + 24;
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer()).buffer;
}
