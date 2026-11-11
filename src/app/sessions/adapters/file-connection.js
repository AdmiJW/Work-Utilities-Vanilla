export const filePickersAvailable = () =>
  typeof globalThis.showOpenFilePicker === 'function' &&
  typeof globalThis.showSaveFilePicker === 'function';
export const workspaceFileOptions = {
  id: 'work-utilities-workspace',
  types: [{ description: 'Work Utilities workspace', accept: { 'application/json': ['.json'] } }],
  excludeAcceptAllOption: true,
};

export async function permission(handle, prompt = false) {
  const options = { mode: 'readwrite' };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  return prompt && (await handle.requestPermission(options)) === 'granted';
}

export async function fingerprint(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function readConnection(handle) {
  const text = await (await handle.getFile()).text();
  return { text, baseline: await fingerprint(text) };
}

/** Commit via a fresh stream, and never acknowledge a write before close succeeds. */
export async function writeConnection(handle, text, baseline) {
  if (!(await permission(handle)))
    throw new Error('File permission is unavailable. Reconnect the workspace file or use Save As.');
  if (baseline !== undefined && (await readConnection(handle)).baseline !== baseline) {
    const error = new Error(
      'The workspace file changed outside this app. Choose Overwrite, Reload, or Save As before saving.',
    );
    error.code = 'FILE_CONFLICT';
    throw error;
  }
  let stream;
  try {
    stream = await handle.createWritable({ keepExistingData: false });
    await stream.write(text);
    await stream.close();
  } catch (error) {
    try {
      await stream?.abort?.();
    } catch {
      /* Preserve the original write failure. */
    }
    throw error;
  }
  return fingerprint(text);
}
