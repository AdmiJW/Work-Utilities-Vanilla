import { exportWorkbook } from '../functions/export-workbook.js';
self.onmessage = async ({ data }) => {
  try {
    const value = await exportWorkbook(data);
    self.postMessage({ type: 'complete', value }, value.buffer ? [value.buffer] : []);
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
self.postMessage({ type: 'ready' });
