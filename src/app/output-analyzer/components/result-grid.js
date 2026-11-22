import { createGrid, ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import { matchesTableSearch } from '../functions/matches-table-search.js';

ModuleRegistry.registerModules([AllCommunityModule]);

export function createResultGrid(
  host,
  statement,
  savedView,
  selected,
  inspect,
  changed,
  search = '',
  countChanged = () => {},
) {
  let restoring = true;
  let query = search;
  const theme = themeQuartz.withParams({
    backgroundColor: 'var(--panel)',
    foregroundColor: 'var(--text)',
    headerBackgroundColor: 'var(--panel-raised)',
    headerTextColor: 'var(--muted)',
    borderColor: 'var(--border)',
    accentColor: 'var(--accent)',
    fontFamily: 'var(--app-font)',
    fontSize: 12,
    rowHeight: 33,
    headerHeight: 34,
    wrapperBorder: false,
  });
  const remember = () => {
    if (restoring) return;
    changed({
      signature: statement.columns.map((column) => column.expression).join('|'),
      filters: api.getFilterModel(),
      columns: api.getColumnState(),
    });
  };
  const select = (row, column) => {
    if (!row || column === '__row' || column === undefined) return;
    const index = Number(column);
    selected({
      columnName: statement.columns[index]?.name ?? '',
      rowNumber: row.lineNumber,
      value: row.values[index] ?? '',
    });
  };
  const api = createGrid(host, {
    rowData: statement.rows,
    columnDefs: [
      {
        headerName: '#',
        colId: '__row',
        width: 60,
        minWidth: 60,
        maxWidth: 80,
        pinned: 'left',
        filter: false,
        sortable: false,
        valueGetter: (params) => String((params.node?.rowIndex ?? 0) + 1),
      },
      ...statement.columns.map((column, index) => ({
        headerName: column.name,
        headerTooltip: column.expression,
        colId: String(index),
        width: Math.min(320, Math.max(160, column.name.length * 9 + 40)),
        valueGetter: (params) => params.data?.values[index] ?? '',
        cellClass: 'mono',
      })),
    ],
    defaultColDef: {
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      cellDataType: false,
      minWidth: 130,
      cellStyle: { whiteSpace: 'pre' },
    },
    theme,
    getRowId: ({ data }) => String(data.lineNumber),
    animateRows: false,
    isExternalFilterPresent: () => !!query,
    doesExternalFilterPass: (node) => matchesTableSearch(node.data.values, query),
    onModelUpdated: (event) => countChanged(event.api.getDisplayedRowCount()),
    onCellClicked: (event) => select(event.data, event.column.getColId()),
    onCellFocused: (event) =>
      select(api.getDisplayedRowAtIndex(event.rowIndex)?.data, event.column?.getColId()),
    onCellDoubleClicked: (event) => {
      select(event.data, event.column.getColId());
      inspect();
    },
    onCellKeyDown: (event) => {
      if (event.event?.key === 'Enter') {
        select(event.data, event.column.getColId());
        inspect();
      }
    },
    onFilterChanged: remember,
    onSortChanged: remember,
    onColumnResized: (event) => event.finished && remember(),
    onColumnMoved: (event) => event.finished && remember(),
  });
  if (savedView?.signature === statement.columns.map((column) => column.expression).join('|')) {
    api.setFilterModel(savedView.filters ?? {});
    if (Array.isArray(savedView.columns))
      api.applyColumnState({ state: savedView.columns, applyOrder: true });
  }
  restoring = false;
  return {
    api,
    setSearch(value) {
      query = value;
      api.onFilterChanged();
    },
    dispose() {
      restoring = true;
      api.destroy();
    },
  };
}
