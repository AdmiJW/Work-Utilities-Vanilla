import { describe, expect, it } from 'vitest';
import { formatJson } from './format-json.js';

describe('JSON formatting', () => {
  it('changes whitespace while preserving token spelling and order', () => {
    const source = String.raw`{ "20":900719925474099312345, "2": -0, "20": [1E+03," a\n\u0020 "] }`;
    const compact = String.raw`{"20":900719925474099312345,"2":-0,"20":[1E+03," a\n\u0020 "]}`;
    const pretty = `{
    "20": 900719925474099312345,
    "2": -0,
    "20": [
        1E+03,
        " a\\n\\u0020 "
    ]
}`;
    expect(formatJson(source, 4)).toBe(pretty);
    expect(formatJson(pretty)).toBe(compact);
    expect(formatJson(compact, 4)).toBe(pretty);
  });

  it('formats scalar values and supports the ends of the indentation range', () => {
    expect(formatJson('  -3e+1000\n', 2)).toBe('-3e+1000');
    expect(formatJson(' true \n')).toBe('true');
    expect(formatJson('[ 0 ]', 1)).toBe('[\n 0\n]');
    expect(formatJson('[ 0 ]', 8)).toBe('[\n        0\n]');
  });

  it.each(['', ' // comment\n{}', '{"n":1,}', '{"n":}'])(
    'rejects invalid input %j before either transformation',
    (source) => {
      expect(() => formatJson(source, 2)).toThrow();
      expect(() => formatJson(source)).toThrow();
    },
  );
});
