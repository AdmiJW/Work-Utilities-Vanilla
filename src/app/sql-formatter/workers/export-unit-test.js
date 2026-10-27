import { exportUnitTest } from '../functions/export-unit-test.js';

self.onmessage = async ({ data }) => {
  try {
    const value = await exportUnitTest(data);
    self.postMessage({ type: 'result', value }, [value]);
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
self.postMessage({ type: 'ready' });
