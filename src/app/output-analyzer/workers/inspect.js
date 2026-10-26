import { inspectValue } from '../functions/inspect-value.js';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ type: 'complete', value: inspectValue(data) });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
self.postMessage({ type: 'ready' });
