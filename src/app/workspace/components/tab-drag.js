/** Keep dragging horizontal even if the pointer leaves the tab strip vertically. */
export function attachTabDrag(host, shell, id, state, commit) {
  let drag = null;
  const finish = (event, cancelled = false) => {
    if (!drag) return;
    const current = drag;
    drag = null;
    current.preview?.remove();
    shell.classList.remove('dragging');
    if (shell.hasPointerCapture(event.pointerId)) shell.releasePointerCapture(event.pointerId);
    if (current.preview && !cancelled) commit(current.order);
  };
  shell.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.tab-close, input') || state.busy) return;
    drag = {
      x: event.clientX,
      bounds: shell.getBoundingClientRect(),
      order: [...state.order],
      preview: null,
    };
  });
  shell.addEventListener('pointermove', (event) => {
    if (!drag || (Math.abs(event.clientX - drag.x) < 5 && !drag.preview)) return;
    event.preventDefault();
    if (!drag.preview) {
      shell.setPointerCapture(event.pointerId);
      drag.preview = shell.cloneNode(true);
      drag.preview.removeAttribute('data-session-id');
      drag.preview.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      drag.preview.className = 'tab-shell tab-drag-preview';
      drag.preview.dataset.runtime = 'true';
      drag.preview.inert = true;
      drag.preview.setAttribute('aria-hidden', 'true');
      Object.assign(drag.preview.style, {
        width: `${drag.bounds.width}px`,
        height: `${drag.bounds.height}px`,
        top: `${drag.bounds.y}px`,
      });
      document.querySelector('#dialogs').append(drag.preview);
      shell.classList.add('dragging');
    }
    drag.preview.style.left = `${drag.bounds.x + event.clientX - drag.x}px`;
    const others = [...host.querySelectorAll('.tab-shell')].filter((node) => node !== shell);
    const target = others.find((node) => {
      const box = node.getBoundingClientRect();
      return event.clientX < box.x + box.width / 2;
    });
    const order = state.order.filter((value) => value !== id);
    order.splice(target ? order.indexOf(target.dataset.sessionId) : order.length, 0, id);
    drag.order = order;
    const bounds = host.getBoundingClientRect();
    if (event.clientX < bounds.x + 20) host.scrollLeft -= 15;
    if (event.clientX > bounds.right - 20) host.scrollLeft += 15;
  });
  shell.addEventListener('pointerup', (event) => finish(event));
  shell.addEventListener('pointercancel', (event) => finish(event, true));
}
