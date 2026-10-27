import { element } from './dom.js';

export function createSidePanelLayout(stage, main, { width: initialWidth, label, changed }) {
  let width = Math.max(280, Math.min(720, Number(initialWidth) || 360));
  let panel = null;
  let drag = null;
  const media = matchMedia('(max-width: 1000px)');
  const divider = element('div', {
    className: 'inspector-resizer',
    role: 'separator',
    tabIndex: 0,
    'aria-label': label,
    'aria-orientation': 'vertical',
    'aria-valuemin': '280',
    'aria-valuemax': '720',
  });
  const render = () => {
    const effectiveWidth = Math.max(280, Math.min(width, stage.clientWidth - 180 || width));
    stage.style.gridTemplateColumns =
      panel && !media.matches ? `minmax(0,1fr) 6px ${effectiveWidth}px` : 'minmax(0,1fr)';
    divider.hidden = !panel || media.matches;
    divider.setAttribute('aria-valuenow', String(width));
    panel?.classList.toggle('overlay-side-panel', media.matches);
    panel?.classList.toggle('overlay-inspector', media.matches);
  };
  const stop = () => {
    if (drag) {
      drag = null;
      changed(width);
    }
  };
  divider.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, width };
    divider.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  divider.addEventListener('pointermove', (event) => {
    if (!drag) return;
    width = Math.max(280, Math.min(720, drag.width + drag.x - event.clientX));
    render();
  });
  divider.addEventListener('pointerup', stop);
  divider.addEventListener('pointercancel', stop);
  divider.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    width =
      event.key === 'Home'
        ? 280
        : event.key === 'End'
          ? 720
          : Math.max(280, Math.min(720, width + (event.key === 'ArrowLeft' ? 20 : -20)));
    render();
    changed(width);
  });
  const observer = new ResizeObserver(render);
  observer.observe(stage);
  media.addEventListener('change', render);
  stage.append(main, divider);
  return {
    show(value) {
      if (panel === value) return;
      panel?.remove();
      panel = value;
      if (panel) stage.append(panel);
      render();
    },
    dispose() {
      observer.disconnect();
      media.removeEventListener('change', render);
    },
  };
}
