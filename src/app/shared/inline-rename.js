import { element } from './dom.js';
import { registerSaveDraft } from './save-drafts.js';

export function startInlineRename(
  trigger,
  value,
  apply,
  {
    label = 'Session name',
    finished = () => {},
    saveSessionId,
    validate,
    onError = () => {},
    describedBy,
  } = {},
) {
  const input = element('input', {
    className: 'inline-name',
    value,
    maxLength: 200,
    'aria-label': label,
    'aria-describedby': describedBy,
  });
  let done = false;
  let baseline = value;
  const nameError = (name) => validate?.(name) ?? (name ? '' : 'Enter a session name.');
  const showError = (error) => {
    if (error) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    input.setCustomValidity(error);
    onError(error);
  };
  const applyDraft = () => {
    const name = input.value.trim();
    const error = nameError(name);
    showError(error);
    if (error) return { valid: false, error, sessionId: saveSessionId };
    if (name !== baseline) apply(name);
    baseline = name;
    input.value = name;
    return { valid: true, sessionId: saveSessionId };
  };
  const unregister = saveSessionId ? registerSaveDraft(input, applyDraft) : () => {};
  input.addEventListener('input', () => showError(''));
  const finish = (commit, keepInvalid = false) => {
    if (done) return;
    const name = input.value.trim();
    const error = commit ? nameError(name) : '';
    if (error && keepInvalid && validate) {
      showError(error);
      return;
    }
    done = true;
    showError('');
    unregister();
    input.replaceWith(trigger);
    finished();
    trigger.focus();
    if (commit && !error && name !== baseline) apply(name);
  };
  input.addEventListener('blur', () => finish(true, true));
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      finish(event.key === 'Enter', true);
    }
  });
  trigger.replaceWith(input);
  input.focus();
  input.select();
  return () => finish(false);
}
