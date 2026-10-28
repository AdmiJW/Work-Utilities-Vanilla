import { build } from 'esbuild';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { collectLicenses } from './collect-licenses.mjs';
import { loadDebugExamples } from './load-debug-examples.mjs';

const options = {
  bundle: true,
  write: false,
  minify: true,
  metafile: true,
  platform: 'browser',
  target: ['chrome120', 'edge120'],
  legalComments: 'inline',
  logLevel: 'warning',
};
const scriptSafe = (value) => value.replace(/<\/script/gi, '<\\/script');

export async function buildApplication() {
  const application = await build({
    ...options,
    entryPoints: ['src/main.js'],
    format: 'iife',
    define: { 'globalThis.__WORK_UTILITIES_EXAMPLES__': JSON.stringify(await loadDebugExamples()) },
  });
  const css = await build({ ...options, entryPoints: ['src/styles.css'] });
  const workerEntries = {
    analyze: 'src/app/output-analyzer/workers/analyze.js',
    inspect: 'src/app/output-analyzer/workers/inspect.js',
    export: 'src/app/output-analyzer/workers/export.js',
    'unit-test': 'src/app/sql-formatter/workers/export-unit-test.js',
  };
  const workers = {};
  const inputs = new Set(Object.keys(application.metafile.inputs));
  for (const [name, entry] of Object.entries(workerEntries)) {
    const result = await build({ ...options, entryPoints: [entry], format: 'iife' });
    workers[name] = result.outputFiles[0].text;
    for (const input of Object.keys(result.metafile.inputs)) inputs.add(input);
  }
  const licenseText = await collectLicenses([...inputs]);
  const template = await readFile('src/template.html', 'utf8');
  const html = template
    .replace('/*__STYLES__*/', () => css.outputFiles[0].text.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__LICENSES__*/', () => scriptSafe(JSON.stringify(licenseText)))
    .replace('/*__WORKERS__*/', () => scriptSafe(JSON.stringify(workers)))
    .replace('/*__APPLICATION__*/', () => scriptSafe(application.outputFiles[0].text));
  if (/<(?:script|link)[^>]+(?:src|href)=["'](?:https?:|\.\/|\/)/i.test(html))
    throw new Error('The application contains an external runtime dependency.');
  if (/\/\*__(?:STYLES|LICENSES|WORKERS|APPLICATION)__\*\//.test(html))
    throw new Error('An artifact placeholder was not replaced.');
  await mkdir('dist', { recursive: true });
  for (const output of ['dist/work-utilities.html', 'index.html']) {
    await writeFile(`${output}.tmp`, html);
    await rename(`${output}.tmp`, output);
  }
  console.log(
    `Built dist/work-utilities.html and index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB each). All runtime resources are embedded.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildApplication();
