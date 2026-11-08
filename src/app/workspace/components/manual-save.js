import { commitSaveDraft } from '../../shared/save-drafts.js';

export function installManualSave(state, feedback) {
  let alive = true,
    timer,
    composing = false,
    deferred = false;
  const show = (text, error = false) => {
    if (!alive) return;
    clearTimeout(timer);
    feedback.textContent = text;
    feedback.hidden = false;
    feedback.classList.toggle('failed', error);
    if (!error)
      timer = setTimeout(() => {
        feedback.hidden = true;
      }, 3000);
  };
  const save = async () => {
    const draft = commitSaveDraft(document.activeElement);
    const result = await state.saveActive(draft.sessionId);
    const names = result.ids
      .map((id) => state.summaries.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
    const text = {
      saved: `Saved ${names || 'current session'}`,
      'memory-only': 'Memory only — export a backup to keep this session.',
      error: result.error || 'Save failed. Retry save or export a backup.',
      busy: 'Wait for the current workspace operation to finish.',
      'no-session': 'No active session to save.',
    }[result.status];
    show(
      draft.valid === false ? `${text} ${draft.error}` : text,
      result.status === 'error' || draft.valid === false,
    );
  };
  const start = () => {
    composing = true;
  };
  const end = () => {
    composing = false;
    if (deferred) {
      deferred = false;
      queueMicrotask(() => {
        if (alive) void save();
      });
    }
  };
  const keydown = (event) => {
    if (
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.key.toLowerCase() !== 's'
    )
      return;
    event.preventDefault();
    if (event.repeat) return;
    if (composing || event.isComposing) {
      deferred = true;
      return;
    }
    void save();
  };
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('compositionstart', start, true);
  document.addEventListener('compositionend', end, true);
  return () => {
    alive = false;
    clearTimeout(timer);
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('compositionstart', start, true);
    document.removeEventListener('compositionend', end, true);
  };
}
