import { EditorSelection, Transaction } from '@codemirror/state';

export function setCaret(view, range, scrollIntoView = true) {
  view.dispatch({
    selection: EditorSelection.create([range]),
    annotations: Transaction.addToHistory.of(false),
    scrollIntoView,
  });
}

/** Intercept table boundaries only; normal text/wrapped-line movement stays native. */
export function enterTable(owner, forward) {
  const view = owner.outer,
    selection = view.state.selection.main;
  if (owner.mode !== 'live' || !selection.empty || view.composing || view.compositionStarted)
    return false;
  const next = view.moveVertically(selection, forward);
  const ordered = [...owner.tables]
    .filter((table) => !table.reading && table.dom.isConnected)
    .sort((a, b) => a.model.from - b.model.from);
  if (!forward) ordered.reverse();
  const table = ordered.find(({ model }) =>
    forward
      ? selection.head <= model.from && next.head >= model.from
      : selection.head >= model.to && next.head <= model.to,
  );
  if (!table) return false;
  const box = view.coordsAtPos(selection.head, selection.assoc || 1);
  const x =
    view.contentDOM.getBoundingClientRect().left +
    (selection.goalColumn ??
      next.goalColumn ??
      (box?.left ?? view.contentDOM.getBoundingClientRect().left) -
        view.contentDOM.getBoundingClientRect().left);
  const row = forward ? 0 : table.model.rows.length - 1;
  let column = 0,
    best = Infinity;
  table.cells[row].forEach((cell, index) => {
    const rect = cell.getBoundingClientRect(),
      distance = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    if (distance < best) {
      best = distance;
      column = index;
    }
  });
  table.edit(row, column, { vertical: { forward, screenX: x } });
  return true;
}

export function visualEdge(view, forward) {
  const selection = view.state.selection.main;
  const boundary = view.moveToLineBoundary(selection, forward, true);
  return forward ? boundary.head === view.state.doc.length : boundary.head === 0;
}
