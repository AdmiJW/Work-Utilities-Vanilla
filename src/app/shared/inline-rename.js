import { element } from './dom.js';
import { registerSaveDraft } from './save-drafts.js';

export function startInlineRename(
  trigger,
  value,
  apply,
  { label = 'Session name', finished = () => {}, saveSessionId } = {},
) {
  const input = element('input', {
    className: 'inline-name',
    value,
    maxLength: 200,
    'aria-label': label,
  });
  let done = false;
  let baseline = value;
  const applyDraft = () => {
    const name = input.value.trim();
    if (!name) {
      input.setAttribute('aria-invalid', 'true');
      input.setCustomValidity('Enter a session name.');
      return { valid: false, error: 'Enter a session name.', sessionId: saveSessionId };
    }
    input.removeAttribute('aria-invalid');
    input.setCustomValidity('');
    if (name !== baseline) apply(name);
    baseline = name;
    input.value = name;
    return { valid: true, sessionId: saveSessionId };
  };
  const unregister = saveSessionId ? registerSaveDraft(input, applyDraft) : () => {};
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    input.setCustomValidity('');
  });
  const finish = (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    unregister();
    input.replaceWith(trigger);
    finished();
    trigger.focus();
    if (commit && name && name !== baseline) apply(name);
  };
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      finish(event.key === 'Enter');
    }
  });
  trigger.replaceWith(input);
  input.focus();
  input.select();
  return () => finish(false);
}
