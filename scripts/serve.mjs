import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(gzip);
const port = Number(process.env.PORT ?? 4273);
createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path !== '/' && path !== '/work-utilities.html') {
      response.writeHead(404).end('Not found');
      return;
    }
    const html = await readFile('dist/work-utilities.html');
    const zipped = request.headers['accept-encoding']?.includes('gzip');
    response.writeHead(200, {
      'Content-Type': 'text/html;charset=utf-8',
      'Cache-Control': 'no-cache',
      ...(zipped ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
    });
    response.end(zipped ? await compress(html) : html);
  } catch {
    response.writeHead(503).end('Build the application first: npm run build');
  }
}).listen(port, '127.0.0.1', () => console.log(`Work Utilities preview: http://127.0.0.1:${port}`));
