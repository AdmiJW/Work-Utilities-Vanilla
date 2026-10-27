export function normalizeBaseName(value) {
  return value
    .trim()
    .replace(/\.(?:sql|xlsx|txt)$/i, '')
    .trim();
}

export function sessionFileName(document, summary) {
  return (
    document?.fileBaseName ??
    (normalizeBaseName(summary?.legacyFileBaseName ?? summary?.name ?? '') || 'untitled')
  );
}
