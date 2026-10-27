import { element } from './dom.js';

export function startInlineRename(
  trigger,
  value,
  apply,
  { label = 'Session name', finished = () => {} } = {},
) {
  const input = element('input', {
    className: 'inline-name',
    value,
    maxLength: 200,
    'aria-label': label,
  });
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.replaceWith(trigger);
    finished();
    trigger.focus();
    if (commit && name && name !== value) apply(name);
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
