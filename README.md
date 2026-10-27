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
- **One-line** removes comments, collapses whitespace outside quoted values, keeps each statement on one physical line, adds its final semicolon, and places one blank line between statements. Statements must already be separated with semicolons. SELECT, INSERT, UPDATE, DELETE, CTEs, and nested expressions are supported.
- Procedural scripts, GO batches, malformed quoting, and physical newlines inside quoted values are rejected instead of silently rewritten. SQL is never executed.
- **Word Wrap** changes display only. **Export SQL** downloads the current text exactly, using the editable export filename. LF/CRLF conventions and file-import undo are preserved. Dragging a file over the editor shows a visible import overlay.

### Unit Test screenshots

SQL Formatter's **Unit Test** button opens a collapsible, resizable right panel; narrow screens use an overlay. Paste images with **Ctrl+V while the panel is focused**, upload PNG/JPEG files, or drop one or more images. There is no automatic clipboard polling. Preview images at full size, reorder them with the up/down controls, or remove individual images.

**Export Unit Test** creates one worksheet containing only the screenshots, in order, at original pixel dimensions with 24 px gaps. There is no cropping, captioning, or image rewriting. The same filename field controls both SQL and unit-test exports: `PT-C-DER112233-01` produces `PT-C-DER112233-01.sql` and `UT-PT-C-DER112233-01.xlsx`.

Images persist with the session and workspace backups. Replacing or editing SQL, changing filenames, or closing a tab does not remove them. Permanently deleting a session removes its stored images. The panel's width and visibility are remembered. Export is disabled until an image exists; processing uses an embedded worker with foreground fallback.

### DER/DPR Output Analyzer

Paste execution output, use **Open TXT**, or drop one `.txt` file onto the source section. TXT imports support replacement, insertion at the captured selection, cancellation, and undo. UTF-8 and BOM-marked UTF-16 files are decoded locally; invalid encodings leave current content intact.

Select **Analyze output** to create a sheet for every SELECT, including repeated tables and zero-row results. The first successful analysis collapses the source input. Editing the input marks results stale and disables Excel export until analysis runs again.

- Column recovery supports CONCAT/CONCAT_WS and ordinary SELECT lists, aliases, joins, CTEs, nested expressions, TOP, and DISTINCT. Computed columns retain their aliases or full expressions; qualified names remain qualified.
- Wildcards and unrecoverable projections infer `Column 1…N` from the widest returned pipe-delimited row. All fallback rows are retained; absent trailing fields display as empty, and inconsistent rows retain their raw text in Diagnostics. Known-projection mismatches remain diagnostics rather than guessed data. Unknown projections with zero rows do not invent columns.
- **Search this table** filters the selected statement using a case-insensitive literal phrase within any individual data cell. It combines with column filters and reports matching rows. Search is remembered per statement; Clear removes only the search. It does not search other result tables or change export contents.
- Double-click a data-result tab or press F2 to rename it inline. Defaults use the source/table name, with suffixes for duplicates, or `Statement #N` when no reliable source name exists. Custom names are used for Excel worksheets and survive reopening/reanalysis when the trimmed SQL is unchanged, matching repeated statements by occurrence. Statements and Diagnostics keep fixed labels.
- Pipe characters inside valid JSON fields are retained. Leading zeros, long numbers, whitespace, dates, and JSON escaping remain text. Sorting and filtering use text semantics.
- Non-SELECT statements appear under **Statements**. Unsupported projections and malformed records retain their raw source under **Diagnostics**.
- Double-click a cell, or press Enter on a focused cell, to inspect it. Once open, clicks and keyboard navigation update the inspector. The edge toggle reopens the last selected cell.
- Tree and Pretty views support **Shallow** and **Deep** decoding, including nested string inspection and back navigation. Inspection preserves numeric tokens and duplicate JSON properties. Deep decoding stops at the existing 32-layer string budget. Raw copy and exports retain the original value.
- The whole inspector scrolls on short screens, including its controls. Tree/Pretty retain 180px minimum height and their own scrolling. Raw-value resizing, manual collapsing, and desktop width resizing remain available, including in the narrow overlay.
- Ordinary non-JSON text receives a readable explanation and retains raw copying. The hidden-inspector toggle sits near the results area's bottom. Analyzer notices have a dismiss button.

The protocol is documented in [sql_output_format.md](sql_output_format.md). Synthetic SQL and all nine analyzer examples are in [examples](examples/).

### Excel export

**Export Excel includes every valid parsed row in original order**, regardless of grid sorting or filtering. SELECT sheets include the original SQL, run marker, row counts, and headers. `_Statements` and `_Diagnostics` are included when applicable.

Every recoverable data range is a real **Excel Table** with filters and banded rows; SQL metadata stays above it. Known zero-row results have header-only tables. Unknown zero-row projections retain metadata and an explanation without fabricated columns. Worksheet names follow renamed result tabs, sanitized and made unique for Excel. Table headers are made nonempty and unique and limited to 255 characters; data values are unchanged.

Data cells are literal Excel text, including values beginning with `=`. There is no numeric/date conversion or scientific notation. Excel's row, column, cell-length, and line-feed limits are validated before download. Oversized exports are blocked with sheet/row/column details; original data is retained without truncation.

## Tabs, sessions, and backups

- Tabs are independent. Double-click or press F2 to rename inline; Enter/blur commits and Escape cancels. Arrow/Home/End keys navigate. Drag horizontally to reorder. Right-click or Shift+F10 opens a context menu with Close, Close to the Right, Close All, and Rename. Menus support keyboard navigation, Escape, and outside-click dismissal.
- Each tool has an independent export basename with a fixed extension. It initially matches the tab name; subsequent tab renames do not change it. Replacement imports adopt the imported basename until the export filename has been manually customized. Insertion, cancelled imports, and failed imports leave it unchanged. Legacy sessions default to their saved tab name.
- Changes autosave **10 seconds after the last edit**. Closing a tab flushes immediately and keeps the saved session in **Session library**. A failed batch-close save leaves the selected tabs open. Page hiding requests a best-effort flush; wait for **All changes saved** before immediately closing after edits.
- With no tabs open, the homepage shows eight recent sessions, including empty sessions. Creation, explicit switching, reopening, and initial restoration record viewing time. Edits, autosaves, reordering, and closing do not change recency. Entries without viewing history use their update/creation time and show **Updated**.
- Session Library supports remembered Date/Name sorting, search, selection, and confirmed permanent deletion. Delayed reads and saves cannot reopen or recreate a deleted session or override newer navigation. Failed deletion retains pending SQL and screenshots so a later close/reopen preserves the current draft.
- Source text and tool preferences are persisted. Derived results are rebuilt when restoring an analyzed session. Editor undo history lasts while its tool session remains open; it is not included in backups. Output-source undo uses bounded snapshots: up to 100 entries with a 64 MB budget, retaining the latest undo pair even for a larger edit.
- **Export workspace** saves all retained session sources, screenshots, filenames, result labels/searches, IDs, metadata, open-tab order, active session, tool options, theme, sidebar, and library sorting. It also recovers in-memory edits and screenshots when autosaving fails.
- **Import workspace** validates a versioned JSON backup and asks before replacing the current workspace exactly. It does not merge sessions. Invalid or unsupported backups leave the existing workspace intact; persistent replacement is transactional.

Browser storage is specific to the browser profile and its handling of local files. Moving, renaming, replacing files, or clearing browser data can affect access to saved sessions. Export a workspace backup before moving or updating the application. If sessions are absent afterward, import that backup.

When storage is blocked, the application displays **Memory only** and remains usable. Export a backup before closing. When background workers are blocked or fail to start, processing falls back to the foreground with a visible reduced-performance message. Large foreground operations can temporarily slow the interface.

Use one editing window for each browser workspace. Supported browser locks enforce this; if locking is unavailable, the application displays that limitation.

## Compatibility and updates

**Browser compatibility** shows the application/version and labeled, colored chips for autosave and background processing. Background processing is unverified until a worker starts or falls back. Dependency notices remain embedded in the HTML without a license section in the dialog. Clipboard denial for text copying opens selected text for Ctrl+C.

**Debug** opens a built-in catalog grouped into SQL Formatter and Output Analyzer. It includes the three SQL examples, nine analyzer examples, and focused regression cases. Choosing a case creates a fresh, saved session with predefined names, source, options, and synthetic screenshots where relevant; analyzer cases open with prepared results. All fixtures are embedded in the HTML. Existing sessions are not replaced, and custom template management is not included.

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

Open [127.0.0.1:4273](http://127.0.0.1:4273), or open `dist/work-utilities.html` directly. `npm run build` generates that single file. Packages are locked through npm and embedded during the build; end users do not download dependencies separately. Current output is approximately 5.1 MB before HTTP compression.

The source uses JavaScript modules for maintainability. esbuild emits classic inline JavaScript with code splitting disabled. Worker bundles are embedded as data and instantiated through Blob URLs. CSS, SVG icons, and license notices are embedded too. The artifact's content security policy disallows application network connections. No runtime dependency on the Angular repository exists.

### Architecture

`src/app` is organized by feature: `workspace`, `sessions`, `sql-formatter`, `output-analyzer`, `sql-language`, `file-transfer`, `appearance`, and `portable-app`. Each feature introduces the components, state, functions, adapters, and workers it needs. `shared` contains small DOM/dialog/icon/background-task primitives.

Cross-feature imports use `public-api.js`; the boundary check enforces dependency direction. Stores publish explicit change events. Components retain their editor/grid state while detached for inactive tabs and dispose on closure. Worker jobs are revision-guarded and cancelled when superseded. Keep functions and files focused, with descriptive names; about 250 lines per source file is a review guideline.

The vanilla database is `work-utilities-vanilla`. IndexedDB version 2 adds a binary `sessionImages` store alongside summaries, documents, and preferences, upgrading version 1 in place. Document schema version remains 1 with optional filename/image metadata. Screenshot bytes are loaded on demand and are not rewritten during ordinary text autosaves. Document/image persistence and permanent deletion are transactional. Workspace backups use `format: "work-utilities-workspace"` and `schemaVersion: 2`, including base64 image payloads; version 1 imports remain supported. Restoration validates references and image metadata before replacing the workspace transactionally. Future schema changes must include deliberate compatibility handling.

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

Verified on **27 October 2026**: lint, 70 feature-boundary checks, formatting, **80 unit tests across 17 files**, and the production build passed. All **36 browser workflows passed in Chrome and Edge in both direct-file and hosted modes (144 checks)**, without retries or skipped cases. Focused checks also cover retaining search text when switching sheets before the debounce expires. Coverage includes native Ctrl+V screenshots, upload/drop/reordering, original image bytes and dimensions in Excel, real Excel Tables, generic SELECT fallback, renamed sheets, independent filenames, v1/v2 backups, invalid-image protection, failed-deletion recovery, memory-only/foreground operation, both themes, short-screen scrolling, and offline workspace transfer. The Docker build ran the same quality and unit checks on Linux. Chrome and Edge exercised SQL, unit-test, and result exports against the local container; health, UID 101, HTML checksum equivalence, cache headers, and missing-file responses were checked. The dependency audit reported zero known vulnerabilities. Managed-browser/native Save As checks remain the manual acceptance checklist above. Generated verification artifacts are removed from the delivered repository; the commands above regenerate them.

## Container

```sh
docker build -t work-utilities-vanilla:local .
docker run --rm -p 8080:8080 work-utilities-vanilla:local
```

The multi-stage Dockerfile installs locked dependencies, runs the quality/unit/build checks, and serves the resulting HTML through unprivileged Nginx on port 8080. It includes a health check, revalidates the HTML, and returns 404 for unknown paths. No application volumes or server-side session storage are required. Deployment, domain, HTTPS, and reverse-proxy configuration are managed separately.

## Existing limits

Arbitrary unescaped pipes in ordinary text and NULL values omitted by CONCAT_WS cannot always be reconstructed. The supported projection shape and existing SQL/Excel limitations remain as documented above. Very large inputs remain subject to browser memory. Automatic request/domain SQL filenames, CONCAT generation, range copying, and grid editing remain deferred.
