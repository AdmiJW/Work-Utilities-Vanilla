import { parseOutputFile } from './parse-output-file.js';
export function analyzeOutput({ source }, progress) {
  return parseOutputFile(source, progress);
}
