import { normalizeBaseName } from '../functions/session-filename.js';
import { tools } from '../../shared/tool-details.js';

export async function createSession(state, toolId, name, source = '', initial = {}) {
  if (state.busy) return null;
  state.cancelNavigation();
  const id = crypto.randomUUID();
  const number = ++state.counters[toolId];
  const title = tools[toolId].title;
  const now = Date.now();
  const summary = {
    id,
    toolId,
    name: name ?? `${title} ${String(number).padStart(2, '0')}`,
    createdAt: now,
    updatedAt: now,
    isOpen: true,
  };
  const document = {
    id,
    schemaVersion: 1,
    source,
    revision: 0,
    fileBaseName: normalizeBaseName(initial.fileBaseName ?? summary.name) || 'untitled',
    fileNameCustomized: false,
    options: { ...initial.options },
  };
  state.summaries = [...state.summaries, summary];
  state.documents.set(id, document);
  state.order.push(id);
  state.activeId = id;
  state.temporary.add(id);
  if (initial.images?.length) state.images.add(id, initial.images);
  else if (source.trim() || name || initial.fileBaseName) state.touch(id);
  else state.notify();
  if (!state.temporary.has(id)) await state.autosave.flush(id);
  return id;
}
