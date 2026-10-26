import { analyzeOutput } from '../functions/analyze-output.js';
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({
      type: 'complete',
      value: await analyzeOutput(data, (value) => self.postMessage({ type: 'progress', value })),
    });
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
self.postMessage({ type: 'ready' });
