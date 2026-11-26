import { compareText } from '../functions/compare-text.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ type: 'complete', value: compareText(data) });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
self.postMessage({ type: 'ready' });
