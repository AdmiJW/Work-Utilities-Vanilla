import { element } from '../shared/dom.js';
import { openDialog } from '../shared/dialog.js';
import { subscribeTo } from '../shared/dom.js';
import { backgroundStatus } from '../shared/background-task.js';

export function openCompatibility(state) {
  const storage = element('span', { className: 'status-chip' });
  const background = element('span', { className: 'status-chip' });
  const set = (chip, text, status) => {
    chip.textContent = text;
    chip.className = 'status-chip ' + status;
  };
  const update = () => {
    set(
      storage,
      !state.repository.persistent
        ? 'Unavailable · memory only'
        : state.autosave.status === 'error'
          ? 'Save failed'
          : 'Available',
      !state.repository.persistent || state.autosave.status === 'error'
        ? 'unavailable'
        : 'available',
    );
    const mode = backgroundStatus.value.mode;
    set(
      background,
      mode === 'workers'
        ? 'Available'
        : mode === 'foreground' || typeof Worker !== 'function'
          ? 'Unavailable · foreground'
          : 'Not tested yet',
      mode === 'workers'
        ? 'available'
        : mode === 'foreground' || typeof Worker !== 'function'
          ? 'unavailable'
          : 'unknown',
    );
  };
  const dialog = openDialog(
    'Browser compatibility',
    element(
      'dl',
      { className: 'compatibility-list' },
      element('dt', {}, 'Application'),
      element('dd', {}, 'Work Utilities Vanilla · version 1.0.0'),
      element('dt', {}, 'Autosave'),
      element('dd', {}, storage),
      element('dt', {}, 'Background'),
      element('dd', {}, background),
    ),
    [{ label: 'Done', action: (close) => close() }],
  );
  const stops = [subscribeTo(state, update), subscribeTo(backgroundStatus, update)];
  dialog.addEventListener('close', () => stops.forEach((stop) => stop()), { once: true });
  update();
  return dialog;
}
