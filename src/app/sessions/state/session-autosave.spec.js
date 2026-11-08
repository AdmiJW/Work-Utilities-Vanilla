import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionAutosave } from './session-autosave.js';

const summary = {
  id: 'one',
  name: 'One',
  toolId: 'sql-formatter',
  createdAt: 1,
  updatedAt: 1,
  isOpen: true,
};
const document = (source) => ({ id: 'one', schemaVersion: 1, source, revision: 0, options: {} });
afterEach(() => vi.useRealTimers());

describe('session autosave', () => {
  it('retains immutable source and deep metadata snapshots when callers change documents', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const autosave = new SessionAutosave({ save }, () => {});
    const note = { ...document('original'), options: { selection: { anchor: 1, head: 2 } } };
    autosave.schedule(summary, note);
    note.source = 'changed';
    note.options.selection.anchor = 9;
    await autosave.flush();
    expect(save.mock.calls[0][1]).toMatchObject({
      source: 'original',
      options: { selection: { anchor: 1, head: 2 } },
    });
    autosave.dispose();
  });
  it('debounces for ten seconds and restarts after edits', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const autosave = new SessionAutosave({ save }, () => {});
    autosave.schedule(summary, document('first'));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(save).not.toHaveBeenCalled();
    autosave.schedule(summary, document('latest'));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith(summary, document('latest'));
    expect(autosave.status).toBe('saved');
  });
  it('drains a newer revision arriving during an in-flight write', async () => {
    let finish;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const autosave = new SessionAutosave({ save }, () => {});
    autosave.schedule(summary, document('first'));
    const flushing = autosave.flush();
    await Promise.resolve();
    autosave.schedule(summary, document('newer'));
    finish();
    expect(await flushing).toBe(true);
    expect(save).toHaveBeenLastCalledWith(summary, document('newer'));
    autosave.dispose();
  });
  it('retains failed snapshots for retry without claiming success', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Quota exceeded'))
      .mockResolvedValue(undefined);
    const autosave = new SessionAutosave({ save }, () => {});
    autosave.schedule(summary, document('recover me'));
    expect(await autosave.flush()).toBe(false);
    expect(autosave.status).toBe('error');
    expect(autosave.error).toContain('Quota');
    expect(await autosave.flush()).toBe(true);
    expect(autosave.status).toBe('saved');
  });
});
