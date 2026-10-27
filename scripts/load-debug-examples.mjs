import { readdir, readFile } from 'node:fs/promises';

export async function loadDebugExamples() {
  const groups = [
    ['sql-formatter', 'examples/sql-formatter', '.sql'],
    ['output-analyzer', 'examples/der-dpr-output analyzer', '.txt'],
  ];
  const examples = [];
  for (const [toolId, folder, extension] of groups) {
    for (const name of (await readdir(folder)).filter((name) => name.endsWith(extension)).sort()) {
      const title = name.slice(0, -extension.length).replace(/[_-]/g, ' ');
      examples.push({
        toolId,
        title,
        description: 'Repository example: ' + name,
        source: await readFile(`${folder}/${name}`, 'utf8'),
        fileBaseName: name.slice(0, -extension.length),
      });
    }
  }
  return examples;
}
