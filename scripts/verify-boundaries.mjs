import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';

const root = resolve('src/app');
const allowed = {
  workspace: [
    'sessions',
    'sql-formatter',
    'output-analyzer',
    'file-transfer',
    'portable-app',
    'appearance',
  ],
  'sql-formatter': ['sessions', 'sql-language', 'file-transfer'],
  'output-analyzer': ['sessions', 'sql-language', 'file-transfer'],
  'portable-app': ['file-transfer'],
  sessions: [],
  'sql-language': [],
  'file-transfer': [],
  appearance: [],
  shared: [],
};
let checked = 0;
async function visit(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!path.endsWith('.js')) continue;
    const feature = relative(root, path).split(sep)[0];
    const text = await readFile(path, 'utf8');
    for (const [, source] of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (!source.startsWith('.')) continue;
      const destination = resolve(dirname(path), source);
      const dependency = relative(root, destination).split(sep)[0];
      if (feature === dependency) continue;
      if (dependency === 'shared') {
        checked++;
        continue;
      }
      if (!allowed[feature]?.includes(dependency) || !destination.endsWith(`${sep}public-api.js`))
        throw new Error(`Forbidden dependency: ${relative(root, path)} → ${source}`);
      checked++;
    }
  }
}
await visit(root);
console.log(`Verified ${checked} cross-feature dependencies through public entry points.`);
