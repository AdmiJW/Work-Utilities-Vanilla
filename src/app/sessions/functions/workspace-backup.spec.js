import { describe, expect, it } from 'vitest';
import { createWorkspaceBackup, readWorkspaceBackup } from './workspace-backup.js';

function backup() {
  return createWorkspaceBackup(
    [
      {
        id: 'one',
        name: 'One',
        toolId: 'sql-formatter',
        createdAt: 1,
        updatedAt: 2,
        lastViewedAt: 3,
        isOpen: true,
      },
    ],
    [
      {
        id: 'one',
        source: 'SELECT 0001;\r\n',
        schemaVersion: 1,
        revision: 0,
        options: { wordWrap: true },
      },
    ],
    { order: ['one'], activeId: 'one', counters: { 'sql-formatter': 1, 'output-analyzer': 0 } },
    { theme: 'dark', collapsed: true, librarySort: 'name' },
  );
}
describe('workspace backup interchange', () => {
  it('accepts Markdown sessions and legacy backups without their new counter', () => {
    const legacy = backup();
    expect(
      readWorkspaceBackup(JSON.stringify(legacy)).workspace.counters['markdown-editor'],
    ).toBeUndefined();
    const value = backup();
    value.summaries[0].toolId = 'markdown-editor';
    value.documents[0].source = '# A note\r\n';
    value.documents[0].options = { mode: 'reading', wide: true };
    value.workspace.counters['markdown-editor'] = 1;
    expect(readWorkspaceBackup(JSON.stringify(value))).toEqual(value);
    value.workspace.counters['markdown-editor'] = -1;
    expect(() => readWorkspaceBackup(JSON.stringify(value))).toThrow();
  });
  it('exports a legacy missing modification time using its creation-time fallback', () => {
    const value = backup();
    const summaries = structuredClone(value.summaries);
    delete summaries[0].updatedAt;
    const exported = createWorkspaceBackup(
      summaries,
      value.documents,
      value.workspace,
      value.appearance,
    );
    expect(readWorkspaceBackup(JSON.stringify(exported)).summaries[0].updatedAt).toBe(1);
    expect(summaries[0].updatedAt).toBeUndefined();
  });
  it('round-trips text, IDs, tabs, recency, tool options and appearance exactly', () => {
    const value = backup();
    expect(readWorkspaceBackup(JSON.stringify(value))).toEqual(value);
  });
  it('rejects malformed, unsupported, duplicate or inconsistent data before restoration', () => {
    expect(() => readWorkspaceBackup('not JSON')).toThrow('not valid JSON');
    for (const modify of [
      (value) => {
        value.schemaVersion = 99;
      },
      (value) => {
        value.summaries[0].legacyFileBaseName = 42;
      },
      (value) => {
        value.summaries.push(value.summaries[0]);
      },
      (value) => {
        value.documents = [];
      },
      (value) => {
        value.workspace.order.push('missing');
      },
      (value) => {
        value.workspace.activeId = 'missing';
      },
      (value) => {
        value.appearance.theme = 'invalid';
      },
      (value) => {
        value.documents[0].revision = -1;
      },
    ]) {
      const value = backup();
      modify(value);
      expect(() => readWorkspaceBackup(JSON.stringify(value))).toThrow();
    }
  });
});
