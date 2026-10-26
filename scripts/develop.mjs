import { watch } from 'node:fs';
import { buildApplication } from './build.mjs';

await buildApplication();
await import('./serve.mjs');
let timer;
let queue = Promise.resolve();
for (const folder of ['src', 'scripts'])
  watch(folder, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      queue = queue.then(buildApplication).catch((error) => console.error(error.message));
    }, 250);
  });
