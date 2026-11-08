const preference =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const running = new Map();

export function cancelMotion(element) {
  running.get(element)?.cancel();
}

function animate(element, entering, { kind = 'surface', duration = entering ? 160 : 120 } = {}) {
  cancelMotion(element);
  if (!element.isConnected || preference?.matches || typeof element.animate !== 'function')
    return Promise.resolve();
  const offset = kind === 'view' ? null : kind === 'panel' ? 'translateX(6px)' : 'translateY(4px)';
  const hidden = { opacity: 0, ...(offset ? { transform: offset } : {}) },
    visible = { opacity: 1, ...(offset ? { transform: 'none' } : {}) };
  const animation = element.animate(entering ? [hidden, visible] : [visible, hidden], {
    duration,
    easing: 'cubic-bezier(.2,.8,.2,1)',
    fill: 'both',
  });
  running.set(element, animation);
  return animation.finished
    .catch(() => {})
    .then(() => {
      if (running.get(element) === animation) running.delete(element);
      animation.cancel();
    });
}
preference?.addEventListener('change', () => {
  if (preference.matches) for (const animation of running.values()) animation.cancel();
});
export const animateEnter = (element, options) => animate(element, true, options);
export const animateExit = (element, options) => animate(element, false, options);
