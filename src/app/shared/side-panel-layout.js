import { element } from './dom.js';
import { animateEnter, animateExit, cancelMotion } from './motion.js';

export function createSidePanelLayout(stage, main, { width: initialWidth, label, changed }) {
  let width = Math.max(280, Math.min(720, Number(initialWidth) || 360));
  let panel = null;
  let drag = null;
  let returnFocus = null;
  const ghosts = new Set();
  stage.classList.add('motion-panel-stage');
  const settled = () => stage.dispatchEvent(new Event('layoutsettled', { bubbles: true }));
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
      stage.classList.remove('is-resizing');
      settled();
    }
  };
  divider.addEventListener('pointerdown', (event) => {
    if (panel) cancelMotion(panel);
    drag = { x: event.clientX, width };
    stage.classList.add('is-resizing');
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
      if (panel) {
        const previous = panel,
          box = previous.getBoundingClientRect(),
          parent = stage.getBoundingClientRect();
        const focused = previous.contains(document.activeElement);
        cancelMotion(previous);
        if (box.width && box.height) {
          const ghost = previous.cloneNode(true);
          ghost.classList.add('motion-panel-ghost');
          ghost.inert = true;
          ghost.setAttribute('aria-hidden', 'true');
          ghost.removeAttribute('id');
          for (const child of ghost.querySelectorAll('[id]')) child.removeAttribute('id');
          Object.assign(ghost.style, {
            position: 'absolute',
            left: `${box.left - parent.left}px`,
            top: `${box.top - parent.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            zIndex: '40',
          });
          stage.append(ghost);
          ghosts.add(ghost);
          void animateExit(ghost, { kind: 'panel' }).then(() => {
            ghost.remove();
            ghosts.delete(ghost);
          });
        }
        previous.remove();
        if (focused && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      }
      panel = value;
      if (panel) {
        returnFocus = document.activeElement;
        stage.append(panel);
      }
      render();
      settled();
      if (panel) void animateEnter(panel, { kind: 'panel' }).then(settled);
    },
    dispose() {
      if (panel) cancelMotion(panel);
      for (const ghost of ghosts) {
        cancelMotion(ghost);
        ghost.remove();
      }
      ghosts.clear();
      observer.disconnect();
      media.removeEventListener('change', render);
    },
  };
}
