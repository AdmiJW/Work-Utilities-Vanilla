export const tools = {
  'sql-formatter': { title: 'SQL Formatter', icon: 'code' },
  'output-analyzer': { title: 'Output Analyzer', icon: 'table' },
  'markdown-editor': { title: 'Markdown Editor', icon: 'markdown' },
  'diff-checker': { title: 'Diff Checker', icon: 'diff' },
  'json-formatter': { title: 'JSON Formatter', icon: 'braces' },
};

export function emptyToolCounters() {
  return Object.fromEntries(Object.keys(tools).map((id) => [id, 0]));
}
