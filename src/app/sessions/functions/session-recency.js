export function sessionRecency(summary) {
  return summary.lastViewedAt ?? summary.updatedAt ?? summary.createdAt;
}

export function recentSessions(summaries) {
  return summaries.toSorted(
    (a, b) => sessionRecency(b) - sessionRecency(a) || a.id.localeCompare(b.id),
  );
}

export function nextViewedAt(summaries) {
  return summaries.reduce(
    (next, summary) => Math.max(next, (summary.lastViewedAt ?? 0) + 1),
    Date.now(),
  );
}

export function preserveLatestView(summary, stored) {
  const lastViewedAt = Math.max(summary.lastViewedAt ?? 0, stored?.lastViewedAt ?? 0);
  return lastViewedAt ? { ...summary, lastViewedAt } : summary;
}
