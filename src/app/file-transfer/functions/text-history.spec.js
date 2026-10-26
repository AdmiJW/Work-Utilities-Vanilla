import { describe, expect, it, vi, afterEach } from 'vitest';
import { TextHistory } from './text-history.js';
afterEach(() => vi.useRealTimers());
describe('source text undo history', () => {
  it('keeps imported files as independent undoable edits and clears redo on a new edit', () => {
    const history = new TextHistory('before');
    history.capture(2, 4);
    history.record('imported', 8, 8);
    expect(history.undo()).toEqual({ text: 'before', start: 2, end: 4 });
    expect(history.redo().text).toBe('imported');
    history.undo();
    history.record('other', 5, 5);
    expect(history.redo().text).toBe('other');
  });
  it('groups consecutive typing but separates navigation and pauses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const history = new TextHistory('');
    history.record('a', 1, 1, 'insertText');
    history.record('ab', 2, 2, 'insertText');
    expect(history.undo().text).toBe('');
    history.redo();
    history.breakGroup();
    history.record('abc', 3, 3, 'insertText');
    expect(history.undo().text).toBe('ab');
    history.redo();
    vi.advanceTimersByTime(1000);
    history.record('abcd', 4, 4, 'insertText');
    expect(history.undo().text).toBe('abc');
  });
  it('bounds retained history while always keeping the last large edit undoable', () => {
    const history = new TextHistory('start');
    for (let index = 0; index < 150; index++) history.record(String(index), 0, 0);
    expect(history.entries.length).toBeLessThanOrEqual(100);
    const value = 'x'.repeat(18_000_000);
    history.record(value, 0, 0);
    history.record(value + 'y', 0, 0);
    expect(history.undo().text).toBe(value);
  });
});
