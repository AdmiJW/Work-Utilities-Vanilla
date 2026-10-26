import { downloadFile } from '../file-transfer/public-api.js';

/** Export the immutable program and an empty mount point, never live session markup. */
export function downloadApplication() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelector('#app-root').replaceChildren();
  clone.querySelector('#dialogs').replaceChildren();
  clone
    .querySelectorAll('style:not(#application-styles), [data-runtime]')
    .forEach((node) => node.remove());
  clone
    .querySelectorAll('script:not(#application-code):not(#worker-data):not(#third-party-licenses)')
    .forEach((node) => node.remove());
  clone
    .querySelectorAll(
      'body > :not(#app-root):not(#dialogs):not(#worker-data):not(#application-code):not(#third-party-licenses)',
    )
    .forEach((node) => node.remove());
  clone.classList.remove('dark');
  clone.removeAttribute('style');
  downloadFile(
    `<!doctype html>\n${clone.outerHTML}`,
    'work-utilities.html',
    'text/html;charset=utf-8',
  );
}
