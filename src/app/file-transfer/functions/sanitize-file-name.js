function sanitizeFileName(name, extension) {
  const cleaned =
    name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\p{Cc}/gu, '_')
      .replace(/[. ]+$/, '')
      .trim() || 'untitled';
  const safe = /^(CON|PRN|AUX|NUL|COM\d|LPT\d)(\.|$)/i.test(cleaned) ? `_${cleaned}` : cleaned;
  return safe.toLowerCase().endsWith(extension) ? safe : `${safe}${extension}`;
}
export { sanitizeFileName };
