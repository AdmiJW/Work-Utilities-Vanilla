import { describe, expect, it } from 'vitest';
import { deepDecodeJson, unwrapSerializedJson } from './decode-serialized-json.js';
import { inspectJson, decodeNestedJson } from './inspect-json.js';
describe('recursive serialized JSON inspection', () => {
  it('decodes nested arrays, objects and repeated string wrappers without losing numeric lexemes or duplicate properties', () => {
    const inner = '{"large":9007199254740993123456789,"x":1,"x":2,"scientific":1e+99}';
    const source = JSON.stringify({
      first: JSON.stringify({ child: JSON.stringify([inner, 'text']) }),
      second: JSON.stringify(JSON.stringify(inner)),
      number: '0001',
      literal: 'true',
      url: '%7B%22x%22%3A1%7D',
    });
    const decoded = deepDecodeJson(source);
    expect(decoded.notice).toBe('');
    const result = inspectJson(decoded.source);
    expect(result.valid).toBe(true);
    expect(result.pretty).toContain('9007199254740993123456789');
    expect(result.pretty).toContain('1e+99');
    expect(result.pretty.match(/"x":/g)).toHaveLength(4);
    expect(result.root.children.find((node) => node.label === 'second').kind).toBe('object');
    expect(result.pretty).toContain('"number": "0001"');
    expect(result.pretty).toContain('"literal": "true"');
    expect(result.pretty).toContain('%7B%22x%22%3A1%7D');
    expect(inspectJson(source).root.children[0].kind).toBe('string');
  });
  it('retains malformed candidates and scalar strings while shallow decoding exposes one layer at a time', () => {
    const source = JSON.stringify({
      bad: '{broken}',
      scalar: '123',
      nested: JSON.stringify(JSON.stringify({ x: 1 })),
    });
    const view = inspectJson(source);
    const nested = view.root.children.find((node) => node.label === 'nested');
    expect(decodeNestedJson(source, nested)).toBe(JSON.stringify(JSON.stringify({ x: 1 })));
    expect(deepDecodeJson(source).source).toContain('"bad":"{broken}"');
    expect(deepDecodeJson(source).source).toContain('"scalar":"123"');
    expect(deepDecodeJson('{invalid}').source).toBe('{invalid}');
  });
  it('respects the remaining string-layer budget without flagging ordinary strings', () => {
    const raw = JSON.stringify(JSON.stringify({ x: 1 }));
    expect(unwrapSerializedJson(raw, 0).source).toBeNull();
    expect(unwrapSerializedJson(raw, 0).limited).toBe(true);
    expect(unwrapSerializedJson(JSON.stringify('ordinary'), 0).limited).toBe(false);
    expect(unwrapSerializedJson(JSON.stringify('{"x":1}'), 1).source).toBe('{"x":1}');
  });
});
