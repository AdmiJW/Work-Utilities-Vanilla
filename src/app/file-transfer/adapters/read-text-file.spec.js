import { describe, expect, it, vi } from 'vitest';
import { readImportedText } from './import-file.js';

describe('file imports', () => {
  it('rejects multiple files or the wrong extension before reading any bytes', async () => {
    const arrayBuffer = vi.fn();
    const file = { name: 'query.sql', arrayBuffer };
    await expect(readImportedText([file, file], '.sql')).rejects.toThrow('one file');
    await expect(readImportedText([file], '.txt')).rejects.toThrow('.txt');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it('retains UTF-8 text and CRLF, and supports BOM-marked UTF-16', async () => {
    expect(await readImportedText([new File(['SELECT 0001;\r\n'], 'QUERY.SQL')], '.sql')).toBe(
      'SELECT 0001;\r\n',
    );
    const file = new File([new Uint8Array([0xff, 0xfe, 0x30, 0, 0x30, 0, 0x31, 0])], 'utf16.txt');
    expect(await readImportedText([file], '.txt')).toBe('001');
  });
  it('rejects invalid encodings instead of replacing characters', async () => {
    await expect(
      readImportedText([new File([new Uint8Array([0xc3, 0x28])], 'invalid.txt')], '.txt'),
    ).rejects.toThrow('not valid UTF-8');
  });
});
