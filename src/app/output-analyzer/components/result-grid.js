import { createGrid, ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export function createResultGrid(host, statement, dark, savedView, selected, inspect, changed) {
  let restoring = true;
  const theme = (isDark) =>
    themeQuartz.withParams({
      backgroundColor: isDark ? '#101b2e' : '#ffffff',
      foregroundColor: isDark ? '#e3ebf7' : '#24344b',
      headerBackgroundColor: isDark ? '#152238' : '#f8fafc',
      headerTextColor: isDark ? '#9aaec7' : '#62748e',
      borderColor: isDark ? '#26354b' : '#e2e8f0',
      accentColor: '#3b82f6',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fontSize: 11,
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
    theme: theme(dark),
    getRowId: ({ data }) => String(data.lineNumber),
    animateRows: false,
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
    setTheme(value) {
      api.setGridOption('theme', theme(value));
    },
    dispose() {
      restoring = true;
      api.destroy();
    },
  };
}
