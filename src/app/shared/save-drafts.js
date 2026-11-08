const drafts = new WeakMap();

export function registerSaveDraft(input, commit) {
  drafts.set(input, commit);
  return () => drafts.delete(input);
}

export function commitSaveDraft(input) {
  return drafts.get(input)?.() ?? { valid: true };
}
