export function matchesTableSearch(values, query) {
  if (!query) return true;
  const term = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(term));
}
