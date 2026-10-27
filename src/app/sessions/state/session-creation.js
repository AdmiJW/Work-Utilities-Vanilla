import { nextViewedAt } from '../functions/session-recency.js';
import { normalizeBaseName } from '../functions/session-filename.js';

export async function createSession(state, toolId, name, source = '', initial = {}) {
  if (state.busy) return null;
  state.cancelNavigation();
  const id = crypto.randomUUID();
  const number = ++state.counters[toolId];
  const title = toolId === 'sql-formatter' ? 'SQL Formatter' : 'Output Analyzer';
  const now = Date.now();
  const summary = {
    id,
    toolId,
    name: name ?? `${title} ${String(number).padStart(2, '0')}`,
    createdAt: now,
    updatedAt: now,
    lastViewedAt: nextViewedAt(state.summaries),
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
  if (initial.images?.length) state.images.add(id, initial.images);
  state.order.push(id);
  state.activeId = id;
  state.autosave.schedule(summary, state.document(id), state.images.pending(state.document(id)));
  state.persistWorkspace();
  state.notify();
  await state.autosave.flush(id);
  return id;
}
