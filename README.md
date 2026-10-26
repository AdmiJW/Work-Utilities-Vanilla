# Work Utilities Vanilla

A portable, browser-only workspace for SQL Server scripts and DER/DPR execution output. The production application is **one self-contained HTML file**: JavaScript, CSS, icons, libraries, background workers, and license notices are included. Application processing uses no backend, CDN, account, analytics, or network connection.

This is an independent repository alongside **Work-Utilities-Angular**. It starts with its own saved sessions; it does not read or migrate the Angular application's browser database.

## Open the application

1. Obtain `dist/work-utilities.html`, or use **Download offline app** on the hosted application.
2. Save the HTML somewhere you can keep it, then open it in desktop **Chrome or Edge**.
3. Use either tool, including file imports and exports, without internet access. No installation, local server, extension, PWA, or DevTools is required.

The download action produces an empty application file. It does not embed the currently displayed SQL, results, or workspace. Saved sessions are handled separately by browser storage and workspace backups.

Native **Save Page As** may also be used with an HTML save format. **HTML only** is suitable because all application resources are inline. Saving a live page as **Webpage, complete** can also capture currently rendered content; prefer **Download offline app** for a clean application copy. A saved copy clears its serialized interface before opening the workspace. The automated portable-file tests exercise downloading and reopening the complete HTML; a native Save As check on the managed corporate browsers is part of the manual acceptance checklist below.

## Use the tools

### SQL Formatter

- Start a session from the sidebar. **Open SQL** or drop one `.sql` file onto the editor. An empty session imports directly; otherwise choose **Replace all**, **Insert at cursor**, or **Cancel**. The session name stays unchanged.
- CodeMirror provides local SQL Server highlighting, line numbers, folding, search/replace, word navigation, selections, and undo/redo. Ctrl+F searches; Ctrl+H replaces; Ctrl+Z undoes; Ctrl+Y or Ctrl+Shift+Z redoes. Tab inserts four spaces.
- **Prettify** retains comments and formats Transact-SQL with four-space indentation.
- **One-line** removes comments, collapses whitespace outside quoted values, keeps each statement on one physical line, and adds its final semicolon. Statements must already be separated with semicolons. SELECT, INSERT, UPDATE, DELETE, CTEs, and nested expressions use the same rules as the Angular edition.
- Procedural scripts, GO batches, malformed quoting, and physical newlines inside quoted values are rejected instead of silently rewritten. SQL is never executed.
- **Word Wrap** changes display only. **Export SQL** downloads the current text exactly, using the sanitized tab name. LF/CRLF conventions and file-import undo are preserved.

### DER/DPR Output Analyzer

Paste execution output, use **Open TXT**, or drop one `.txt` file onto the source section. TXT imports support replacement, insertion at the captured selection, cancellation, and undo. UTF-8 and BOM-marked UTF-16 files are decoded locally; invalid encodings leave current content intact.

Select **Analyze output** to create a sheet for every SELECT, including repeated tables and zero-row results. The first successful analysis collapses the source input. Editing the input marks results stale and disables Excel export until analysis runs again.

- Column recovery supports the documented CONCAT/CONCAT_WS projection shape, joins, CTEs, nested expressions, TOP, and DISTINCT. Computed columns retain their aliases or full expressions; qualified names remain qualified.
- Pipe characters inside valid JSON fields are retained. Leading zeros, long numbers, whitespace, dates, and JSON escaping remain text. Sorting and filtering use text semantics.
- Non-SELECT statements appear under **Statements**. Unsupported projections and malformed records retain their raw source under **Diagnostics**.
- Double-click a cell, or press Enter on a focused cell, to inspect it. Once open, clicks and keyboard navigation update the inspector. The edge toggle reopens the last selected cell.
- Tree and Pretty views support **Shallow** and **Deep** decoding, including nested string inspection and back navigation. Inspection preserves numeric tokens and duplicate JSON properties. Deep decoding stops at the existing 32-layer string budget. Raw copy and exports retain the original value.
- The whole inspector scrolls on short screens, including its controls. Tree/Pretty retain 180px minimum height and their own scrolling. Raw-value resizing, manual collapsing, and desktop width resizing remain available, including in the narrow overlay.

The protocol is documented in [sql_output_format.md](sql_output_format.md). Synthetic SQL and all nine analyzer examples are in [examples](examples/).

### Excel export

**Export Excel includes every valid parsed row in original order**, regardless of grid sorting or filtering. SELECT sheets include the original SQL, run marker, row counts, and headers. `_Statements` and `_Diagnostics` are included when applicable.

Data cells are literal Excel text, including values beginning with `=`. There is no numeric/date conversion or scientific notation. Excel's row, column, cell-length, and line-feed limits are validated before download. Oversized exports are blocked with sheet/row/column details; original data is retained without truncation.

## Tabs, sessions, and backups

- Tabs are independent. Double-click or press F2 to rename; arrow/Home/End keys navigate. Drag horizontally to reorder. Right-click or Shift+F10 opens Close, Close to the Right, Close All, and Rename.
- Changes autosave **10 seconds after the last edit**. Closing a tab flushes immediately and keeps the saved session in **Session library**. A failed batch-close save leaves the selected tabs open. Page hiding requests a best-effort flush; wait for **All changes saved** before immediately closing after edits.
- With no tabs open, the homepage shows eight recent sessions, including empty sessions. Creation, explicit switching, reopening, and initial restoration record viewing time. Edits, autosaves, reordering, and closing do not change recency. Entries without viewing history use their update/creation time and show **Updated**.
- Session Library supports remembered Date/Name sorting, search, selection, and confirmed permanent deletion. Delayed reads and saves cannot reopen or recreate a deleted session or override newer navigation.
- Source text and tool preferences are persisted. Derived results are rebuilt when restoring an analyzed session. Editor undo history lasts while its tool session remains open; it is not included in backups. Output-source undo uses bounded snapshots: up to 100 entries with a 64 MB budget, retaining the latest undo pair even for a larger edit.
- **Export workspace** saves all retained session sources, IDs, metadata, open-tab order, active session, tool options, theme, sidebar, and library sorting. It also recovers in-memory edits when autosaving fails.
- **Import workspace** validates a versioned JSON backup and asks before replacing the current workspace exactly. It does not merge sessions. Invalid or unsupported backups leave the existing workspace intact; persistent replacement is transactional.

Browser storage is specific to the browser profile and its handling of local files. Moving, renaming, replacing files, or clearing browser data can affect access to saved sessions. Export a workspace backup before moving or updating the application. If sessions are absent afterward, import that backup.

When storage is blocked, the application displays **Memory only** and remains usable. Export a backup before closing. When background workers are blocked or fail to start, processing falls back to the foreground with a visible reduced-performance message. Large foreground operations can temporarily slow the interface.

Use one editing window for each browser workspace. Supported browser locks enforce this; if locking is unavailable, the application displays that limitation.

## Compatibility and updates

**Browser compatibility** in the header shows storage, background processing, window-lock status, update instructions, and embedded dependency licenses. **Test a download** requests a synthetic text file; check the browser's downloads list to confirm it was saved. Clipboard denial opens selected text for Ctrl+C.

Updates are manual: export a workspace backup, obtain the new HTML, replace the local application file, and reopen it. Retain the same location where possible. There are no service workers, background update requests, or automatic reloads.

For the corporate-laptop acceptance test, use both managed Chrome and Edge without DevTools:

1. Open the local HTML with the network disconnected.
2. Type and paste SQL/output and check responsiveness.
3. Import SQL/TXT and export SQL/Excel; reopen the downloaded files.
4. Close/reopen a tool, reload the HTML, and restore a workspace backup.
5. Exercise native HTML Save Page As and reopen that copy.

Corporate browser/endpoint filtering can still affect a local page. The application does not alter browser security settings. The completed file is supplied for this final environment-specific test after development verification.

## Develop and build

Development requires **Node 24**, npm, and Chrome/Edge. These tools are needed only on the development computer.

```sh
npm ci
npm start
```

The development preview rebuilds the self-contained file when source changes. For a release:

```sh
npm run check
npm run preview
```

Open [127.0.0.1:4273](http://127.0.0.1:4273), or open `dist/work-utilities.html` directly. `npm run build` generates that single file. Packages are locked through npm and embedded during the build; end users do not download dependencies separately. Current output is approximately 3.8 MB before HTTP compression.

The source uses JavaScript modules for maintainability. esbuild emits classic inline JavaScript with code splitting disabled. Worker bundles are embedded as data and instantiated through Blob URLs. CSS, SVG icons, and license notices are embedded too. The artifact's content security policy disallows application network connections. No runtime dependency on the Angular repository exists.

### Architecture

`src/app` is organized by feature: `workspace`, `sessions`, `sql-formatter`, `output-analyzer`, `sql-language`, `file-transfer`, `appearance`, and `portable-app`. Each feature introduces the components, state, functions, adapters, and workers it needs. `shared` contains small DOM/dialog/icon/background-task primitives.

Cross-feature imports use `public-api.js`; the boundary check enforces dependency direction. Stores publish explicit change events. Components retain their editor/grid state while detached for inactive tabs and dispose on closure. Worker jobs are revision-guarded and cancelled when superseded. Keep functions and files focused, with descriptive names; about 250 lines per source file is a review guideline.

The vanilla database is `work-utilities-vanilla`, with separate summary/document/preference stores. Document and IndexedDB schema versions are 1. Workspace backups use `format: "work-utilities-workspace"` and `schemaVersion: 1`. Future schema changes must include deliberate compatibility handling.

### Verification

```sh
npm test
npm run lint
npm run check:boundaries
npm run format:check
npm run build
npm run test:e2e
```

The browser suite runs Chrome and Edge in direct-file and hosted modes. Set `PLAYWRIGHT_CHANNEL=chrome` or `msedge`, and optionally `TEST_MODE=file` or `hosted`, to select a subset. `TEST_BASE_URL` can target an already running local container. The preview server starts automatically when hosted tests need it.

Coverage includes exact SQL/JSON/Excel data, all protocol fixtures, session races and lifecycle failures, backup replacement, unavailable storage/workers/clipboard, downloaded-file offline use, short-screen scrolling, themes, and a 50,000-row representative 20 MB file. Generated reports, screenshots, fixtures, and metrics go into ignored `artifacts/` and `test-results/`; they can be removed after review.

Verified on **26 October 2026**: lint, feature boundaries, formatting, **58 unit tests across 14 files**, and the production build passed. All **26 browser workflows passed in Chrome and Edge in both direct-file and hosted modes (104 checks)**, without retries or skipped cases. Hosted Edge tests ran against the Docker image. Downloaded-file operation, workspace transfer and restoration, retained data after replacing the HTML, clipboard/storage/worker restrictions, both themes, and short-screen scrolling were exercised. Container health, UID 101, HTML checksum equivalence, cache headers, and missing-file responses were checked. The dependency audit reported zero known vulnerabilities. Corporate-laptop acceptance and native Save As on the managed browsers remain the post-delivery manual checklist above, as agreed.

## Container

```sh
docker build -t work-utilities-vanilla:local .
docker run --rm -p 8080:8080 work-utilities-vanilla:local
```

The multi-stage Dockerfile installs locked dependencies, runs the quality/unit/build checks, and serves the resulting HTML through unprivileged Nginx on port 8080. It includes a health check, revalidates the HTML, and returns 404 for unknown paths. No application volumes or server-side session storage are required. Deployment, domain, HTTPS, and reverse-proxy configuration are managed separately.

## Existing limits

Arbitrary unescaped pipes in ordinary text and NULL values omitted by CONCAT_WS cannot always be reconstructed. The supported projection shape and existing SQL/Excel limitations remain as documented above. Very large inputs remain subject to browser memory. Automatic request/domain SQL filenames, CONCAT generation, range copying, and grid editing remain deferred.
