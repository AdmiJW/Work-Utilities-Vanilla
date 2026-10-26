import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

export async function collectLicenses(inputs) {
  const packages = new Map();
  for (const input of inputs.filter((path) => path.includes('node_modules/'))) {
    let directory = dirname(resolve(input));
    while (directory.includes('node_modules')) {
      try {
        const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
        if (metadata.name && metadata.version) {
          if (!packages.has(metadata.name)) {
            const notices = [];
            for (const name of [
              'LICENSE',
              'LICENSE.md',
              'LICENSE.txt',
              'license',
              'license.txt',
              'NOTICE',
              'NOTICE.txt',
              'COPYING',
            ]) {
              try {
                notices.push(await readFile(join(directory, name), 'utf8'));
              } catch {
                /* Not every package uses the same filename. */
              }
            }
            packages.set(
              metadata.name,
              `${metadata.name} ${metadata.version} — ${typeof metadata.license === 'string' ? metadata.license : JSON.stringify(metadata.license)}\n${[...new Set(notices)].join('\n\n')}`,
            );
          }
          break;
        }
      } catch {
        /* Continue from nested distribution directories to the package root. */
      }
      directory = dirname(directory);
    }
  }
  return [...packages.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([, notice]) => notice)
    .join('\n\n────────────────────────────────────────\n\n');
}
