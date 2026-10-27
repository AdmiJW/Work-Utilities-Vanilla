export function tableHeaders(headers) {
  const used = new Set();
  return headers.map((value, index) => {
    const base = value.trim().slice(0, 255) || `Column ${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name.toUpperCase())) {
      const tail = ` (${suffix++})`;
      name = base.slice(0, 255 - tail.length) + tail;
    }
    used.add(name.toUpperCase());
    return name;
  });
}
