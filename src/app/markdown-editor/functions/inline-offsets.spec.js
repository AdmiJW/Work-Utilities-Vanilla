import { it, expect } from 'vitest';
import { sourceOffset } from './inline-offsets.js';

it('maps decoded escape/entity boundaries without expanding the whole source', () => {
  const decode = (token) => ({ '\\*': '*', '&amp;': '&', '&#x1F600;': '😀' })[token] ?? token;
  expect(sourceOffset('a\\*b &amp; c', 2, decode)).toBe(3);
  expect(sourceOffset('a\\*b &amp; c', 5, decode)).toBe(10);
  expect(sourceOffset('&#x1F600; text', 2, decode)).toBe(9);
  expect(sourceOffset('plain text', 6, decode)).toBe(6);
});
