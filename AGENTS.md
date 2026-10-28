# Repository instructions

- The repository-root `index.html` is the complete application copy distributed through GitHub. It is generated; edit source files instead.
- After any change affecting application output, run `npm run build` (or `npm run check`, which includes the build). Include the regenerated `index.html` with the source changes in the same commit. Both it and `dist/work-utilities.html` must contain identical bytes.
- Keep `index.html` self-contained for offline use: embed all runtime code, styles, workers, icons, and dependency notices. Do not introduce runtime downloads.
