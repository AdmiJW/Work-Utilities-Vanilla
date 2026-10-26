import { describe, expect, it } from 'vitest';
import { decodeNestedJson, inspectJson } from './inspect-json.js';
describe('lossless JSON inspection', () => {
  it('preserves large numeric lexemes and duplicate object properties', () => {
    const result = inspectJson('{"id":9007199254740993123456789,"x":1,"x":2,"scientific":1e+99}');
    expect(result.valid).toBe(true);
    expect(result.pretty).toContain('9007199254740993123456789');
    expect(result.pretty).toContain('1e+99');
    expect(result.root.children.map((node) => node.label)).toEqual(['id', 'x', 'x', 'scientific']);
  });
  it('decodes a serialized JSON string without parsing its inner numeric values', () => {
    const inner = '{"large":9007199254740993123456789,"label":"x | y"}';
    const source = JSON.stringify({ UserContext: inner });
    const result = inspectJson(source);
    expect(decodeNestedJson(source, result.root.children[0])).toBe(inner);
    expect(result.pretty).toContain('\\"label\\"');
  });
  it('treats invalid JSON, comments and trailing commas as raw values', () => {
    for (const source of ['plain text', '{"a":1,}', '{/* comment */"a":1}', ''])
      expect(inspectJson(source).valid).toBe(false);
  });
});
