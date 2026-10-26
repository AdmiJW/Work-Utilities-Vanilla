const toolIds = new Set(['sql-formatter', 'output-analyzer']);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const time = (value) => Number.isFinite(value) && value >= 0;

/** Validate the complete interchange file before any persistent changes. */
export function readWorkspaceBackup(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The backup is not valid JSON.');
  }
  if (!record(value) || value.format !== 'work-utilities-workspace' || value.schemaVersion !== 1)
    throw new Error('This is not a supported Work Utilities Vanilla workspace backup.');
  const invalid = () => {
    throw new Error(
      'The backup contains invalid or inconsistent session data. Nothing was restored.',
    );
  };
  if (
    !Array.isArray(value.summaries) ||
    !Array.isArray(value.documents) ||
    !record(value.workspace) ||
    !record(value.appearance)
  )
    invalid();
  const ids = new Set();
  for (const item of value.summaries) {
    if (
      !record(item) ||
      typeof item.id !== 'string' ||
      !/^[A-Za-z0-9_-]{1,100}$/.test(item.id) ||
      ids.has(item.id) ||
      !toolIds.has(item.toolId) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      !time(item.createdAt) ||
      !time(item.updatedAt) ||
      (item.lastViewedAt !== undefined && !time(item.lastViewedAt)) ||
      typeof item.isOpen !== 'boolean'
    )
      invalid();
    ids.add(item.id);
  }
  const bodies = new Set();
  for (const item of value.documents) {
    if (
      !record(item) ||
      !ids.has(item.id) ||
      bodies.has(item.id) ||
      item.schemaVersion !== 1 ||
      typeof item.source !== 'string' ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 0 ||
      !record(item.options)
    )
      invalid();
    bodies.add(item.id);
  }
  if (bodies.size !== ids.size) invalid();
  const { order, activeId, counters } = value.workspace;
  const openIds = value.summaries.filter((item) => item.isOpen).map((item) => item.id);
  if (
    !Array.isArray(order) ||
    order.length !== openIds.length ||
    new Set(order).size !== order.length ||
    order.some((id) => !openIds.includes(id)) ||
    (activeId !== null && !order.includes(activeId)) ||
    !record(counters) ||
    [...toolIds].some((id) => !Number.isSafeInteger(counters[id]) || counters[id] < 0)
  )
    invalid();
  if (
    !['light', 'dark'].includes(value.appearance.theme) ||
    typeof value.appearance.collapsed !== 'boolean'
  )
    invalid();
  if (
    value.appearance.librarySort !== undefined &&
    !['date', 'name'].includes(value.appearance.librarySort)
  )
    invalid();
  return value;
}

export function createWorkspaceBackup(summaries, documents, workspace, appearance) {
  return {
    format: 'work-utilities-workspace',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    summaries: summaries.map((summary) => ({
      ...summary,
      updatedAt: summary.updatedAt ?? summary.createdAt,
    })),
    documents,
    workspace,
    appearance,
  };
}
