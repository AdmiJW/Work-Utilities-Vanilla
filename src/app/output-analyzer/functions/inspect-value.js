import { inspectJson } from './inspect-json.js';
import { deepDecodeJson } from './decode-serialized-json.js';
export function inspectValue({ source, mode }) {
  const view = mode === 'deep' ? deepDecodeJson(source) : { source, notice: '' };
  return { ...view, inspection: inspectJson(view.source) };
}
